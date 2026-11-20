import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { CLI_CLIENT_ID, CLI_SCOPE } from "../../shared/contracts.js";
import { TOOL_KINDS } from "../../shared/tool-activity.js";
import { authMiddleware } from "../api/middleware/auth.js";
import type { AppEnv } from "../api/types/hono.js";
import { accountStatus } from "../services/account.js";
import type { WaitUntilContext } from "../services/d1-utils.js";
import { createServices } from "../services/index.js";
import { RateLimitService } from "../services/rate-limit.js";
import { extractClientInfo } from "../services/request-info.js";
import { ToolCallLogger } from "../services/tool-call-logger.js";
import { rejectOperation, ToolService } from "../services/tool-service.js";
import type { AuthContext, Services } from "../services/types.js";
import type { Env } from "../shared/types.js";
import { CLIAuthorization, OAuthError } from "./authorization.js";

const auth = (env: Env, request: Request) =>
	new CLIAuthorization(env.DB, env.JWT_SECRET, new URL(request.url).origin);
const noStore = { "Cache-Control": "no-store", Pragma: "no-cache" };
export const authorizationMetadata = (origin: string) => ({
	issuer: origin,
	authorization_endpoint: `${origin}/oauth/cli/authorize`,
	token_endpoint: `${origin}/oauth/cli/token`,
	device_authorization_endpoint: `${origin}/oauth/cli/device/code`,
	revocation_endpoint: `${origin}/oauth/cli/revoke`,
	response_types_supported: ["code"],
	grant_types_supported: [
		"authorization_code",
		"refresh_token",
		"urn:ietf:params:oauth:grant-type:device_code",
	],
	code_challenge_methods_supported: ["S256"],
	token_endpoint_auth_methods_supported: ["none"],
	scopes_supported: CLI_SCOPE.split(" "),
});

export const cliOAuthRoutes = new Hono<AppEnv>();
cliOAuthRoutes.use("*", bodyLimit({ maxSize: 16 * 1024 }));
cliOAuthRoutes.use("*", async (c, next) => {
	for (const [k, v] of Object.entries(noStore)) c.header(k, v);
	await next();
});
cliOAuthRoutes.onError((error, _c) => {
	if (error instanceof OAuthError)
		return Response.json(
			{ error: error.error, error_description: error.message },
			{ status: error.status, headers: noStore },
		);
	if (error instanceof z.ZodError)
		return Response.json(
			{ error: "invalid_request", error_description: "Invalid authorization parameters." },
			{ status: 400, headers: noStore },
		);
	console.error("CLI authorization is temporarily unavailable.");
	return Response.json(
		{
			error: "temporarily_unavailable",
			error_description: "CLI authorization is temporarily unavailable.",
		},
		{ status: 503, headers: noStore },
	);
});
async function form(request: Request): Promise<Record<string, unknown>> {
	const type = request.headers.get("Content-Type") ?? "";
	if (type.includes("application/x-www-form-urlencoded"))
		return Object.fromEntries(new URLSearchParams(await request.text()));
	throw new OAuthError("invalid_request", "Use application/x-www-form-urlencoded.");
}
cliOAuthRoutes.get("/authorize", async (c) => {
	const service = auth(c.env, c.req.raw);
	await service.rateLimit(extractClientInfo(c.req.raw).ip, "authorize", 20);
	const result = await service.start(c.req.query(), "code");
	return c.redirect("authorization_url" in result ? result.authorization_url! : "/", 302);
});
cliOAuthRoutes.post("/device/code", async (c) => {
	const service = auth(c.env, c.req.raw);
	await service.rateLimit(extractClientInfo(c.req.raw).ip, "device", 20);
	return c.json(await service.start(await form(c.req.raw), "device"));
});
cliOAuthRoutes.post("/token", async (c) => {
	const service = auth(c.env, c.req.raw);
	await service.rateLimit(extractClientInfo(c.req.raw).ip, "token", 60);
	return c.json(await service.exchange(await form(c.req.raw)));
});
cliOAuthRoutes.post("/revoke", async (c) => {
	const service = auth(c.env, c.req.raw);
	await service.rateLimit(extractClientInfo(c.req.raw).ip, "revoke", 30);
	const input = await form(c.req.raw);
	if (input.client_id !== CLI_CLIENT_ID)
		throw new OAuthError("invalid_client", "Unknown CLI client.");
	await service.revoke(z.string().max(4096).parse(input.token));
	return c.body(null, 200);
});

export function createCLIRoutes(
	factory: (env: Env, ctx: WaitUntilContext) => Promise<Services> = (env, ctx) =>
		createServices(env, ctx, "cli"),
) {
	const app = new Hono<AppEnv>();
	app.use("*", bodyLimit({ maxSize: 16 * 1024 }));
	app.use("*", async (c, next) => {
		for (const [k, v] of Object.entries(noStore)) c.header(k, v);
		await next();
	});
	app.onError((error, c) => {
		if (c.req.raw.signal.aborted) return new Response(null, { status: 499, headers: noStore });
		if (error instanceof OAuthError)
			return Response.json(
				{ success: false, error: { code: error.error, message: error.message } },
				{ status: error.status, headers: noStore },
			);
		if (error instanceof z.ZodError)
			return c.json(
				{
					success: false,
					error: { code: "INVALID_ARGUMENTS", message: "Invalid request parameters." },
				},
				400,
			);
		console.error("CLI service is temporarily unavailable.");
		return c.json(
			{
				success: false,
				error: { code: "SERVICE_UNAVAILABLE", message: "CLI service is temporarily unavailable." },
			},
			503,
		);
	});
	app.get("/v1/health", (c) =>
		c.json({
			ok: true,
			channel: "cli",
			operations: TOOL_KINDS,
			authorization_server: new URL(c.req.url).origin,
		}),
	);
	app.get("/v1/account", async (c) => {
		const identity = await auth(c.env, c.req.raw).authenticate(c.req.raw);
		const quota = await new RateLimitService(c.env.DB).getStatus(
			extractClientInfo(c.req.raw).ip,
			identity,
		);
		return c.json(accountStatus(identity, quota, "cli"));
	});
	for (const operation of TOOL_KINDS)
		app.post(`/v1/${operation}`, (c) => {
			const response = (async () => {
				let identity: AuthContext = { isAuthenticated: false };
				let input: unknown;
				const logger = new ToolCallLogger(c.env.DB, c.executionCtx);
				try {
					input = await c.req.json();
				} catch {
					const result = rejectOperation(logger, operation, {}, identity, c.req.raw, "cli");
					return Response.json(result, {
						status: 400,
						headers: { ...noStore, "X-Request-ID": result.request_id! },
					});
				}
				try {
					identity = await auth(c.env, c.req.raw).authenticate(c.req.raw);
				} catch (error) {
					if (!(error instanceof OAuthError)) throw error;
					const result = rejectOperation(
						logger,
						operation,
						input,
						identity,
						c.req.raw,
						"cli",
						"INVALID_TOKEN",
						"CLI credential rejected. Run apple-rag auth login.",
						401,
					);
					return Response.json(result, {
						status: 401,
						headers: {
							...noStore,
							"X-Request-ID": result.request_id!,
							"WWW-Authenticate": 'Bearer error="invalid_token"',
						},
					});
				}
				const services = await factory(c.env, c.executionCtx);
				const tools = new ToolService(services);
				try {
					const result = await tools.execute(operation, input, identity, c.req.raw, "cli");
					return Response.json(result, {
						status: result.ok ? 200 : result.error.status,
						headers: { ...noStore, "X-Request-ID": result.request_id! },
					});
				} finally {
					await services.database.close();
				}
			})();
			c.executionCtx.waitUntil(response.catch(() => {}));
			return response;
		});
	// These management endpoints use the existing website session, never CLI/MCP credentials.
	app.use("/authorization", authMiddleware);
	app.get("/authorization", async (c) => {
		const service = auth(c.env, c.req.raw);
		await service.rateLimit(c.get("userId"), "inspect", 20);
		const query = z
			.object({ request: z.string().max(100).optional(), user_code: z.string().max(20).optional() })
			.refine((v) => !!v.request !== !!v.user_code)
			.parse(c.req.query());
		return c.json({ success: true, data: await service.describe(query.request, query.user_code) });
	});
	app.post("/authorization", async (c) => {
		const service = auth(c.env, c.req.raw);
		await service.rateLimit(c.get("userId"), "approve", 10);
		const input = z
			.object({
				request: z.string().max(100).optional(),
				user_code: z.string().max(20).optional(),
				approve: z.boolean(),
			})
			.refine((v) => !!v.request !== !!v.user_code)
			.parse(await c.req.json());
		return c.json({
			success: true,
			data: await service.decide(c.get("userId"), input.approve, input.request, input.user_code),
		});
	});
	app.use("/sessions", authMiddleware);
	app.use("/sessions/*", authMiddleware);
	app.get("/sessions", async (c) =>
		c.json({ success: true, data: await auth(c.env, c.req.raw).list(c.get("userId")) }),
	);
	app.delete("/sessions/:id", async (c) => {
		await auth(c.env, c.req.raw).revokeSession(c.req.param("id"), c.get("userId"));
		return c.json({ success: true });
	});
	app.post("/sessions", async (c) => {
		const service = auth(c.env, c.req.raw);
		await service.rateLimit(c.get("userId"), "create-key", 5);
		const input = z
			.object({ name: z.string().trim().min(1).max(80), days: z.number().int().min(1).max(90) })
			.parse(await c.req.json());
		return c.json(
			{ success: true, data: await service.createKey(c.get("userId"), input.name, input.days) },
			201,
		);
	});
	return app;
}
