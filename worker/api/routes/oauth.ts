/**
 * OAuth Authentication Routes
 * Unified OAuth handling for Google and GitHub
 */
import { createRoute, z } from "@hono/zod-openapi";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { OAuthService } from "../services/oauth-service";
import { createOpenAPIApp } from "../utils/openapi";
import { verifyWebToken } from "../utils/web-session";

const app = createOpenAPIApp();

// Unified OAuth provider type
const OAuthProvider = z.enum(["google", "github"]);

// Unified OAuth callback query schema
const OAuthCallbackSchema = z.object({
	code: z.string().min(1, "Authorization code is required"),
	state: z.string().optional(),
});

// Unified OAuth response schemas
const OAuthUrlResponseSchema = z.object({
	success: z.boolean(),
	data: z.object({
		auth_url: z.string(),
	}),
});

// Unified OAuth initiation route
const oauthInitRoute = createRoute({
	method: "post",
	path: "/{provider}",
	request: {
		params: z.object({
			provider: OAuthProvider,
		}),
		body: {
			content: {
				"application/json": {
					schema: z.object({}),
				},
			},
		},
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: OAuthUrlResponseSchema,
				},
			},
			description: "OAuth authorization URL generated successfully",
		},
	},
	tags: ["Authentication", "OAuth"],
});

app.openapi(oauthInitRoute, async (c) => {
	const provider = c.req.valid("param").provider;
	const state = crypto.randomUUID();
	setCookie(c, "oauth_state_" + provider, state, {
		httpOnly: true,
		secure: new URL(c.req.url).protocol === "https:",
		sameSite: "Lax",
		path: "/api/oauth",
		maxAge: 600,
	});
	const origin = new URL(c.req.url).origin;
	const oauthService = new OAuthService(c.env, origin);

	const authUrl = oauthService.getAuthUrl(provider, state);

	return c.json({
		success: true,
		data: { auth_url: authUrl },
	});
});

// Unified OAuth callback route
const oauthCallbackRoute = createRoute({
	method: "get",
	path: "/{provider}/callback",
	request: {
		params: z.object({
			provider: OAuthProvider,
		}),
		query: OAuthCallbackSchema,
	},
	responses: {
		302: {
			description: "Redirect to frontend with authentication data or error",
		},
	},
	tags: ["Authentication", "OAuth"],
});

app.openapi(oauthCallbackRoute, async (c) => {
	const provider = c.req.valid("param").provider;
	const { code, state } = c.req.valid("query");
	const expected = getCookie(c, "oauth_state_" + provider);
	deleteCookie(c, "oauth_state_" + provider, { path: "/api/oauth" });
	if (!state || !expected || state !== expected)
		return c.redirect("/login?error=Invalid%20login%20state");
	const origin = new URL(c.req.url).origin;
	const oauthService = new OAuthService(c.env, origin);

	const result = await oauthService.handleCallback(provider, code);

	if (result.success && result.data) {
		setCookie(c, "oauth_handoff", result.data.jwtToken, {
			httpOnly: true,
			secure: new URL(origin).protocol === "https:",
			sameSite: "Strict",
			path: "/api/oauth/session/exchange",
			maxAge: 60,
		});
		c.header("Cache-Control", "no-store");
		return c.redirect(origin + "/overview?login=complete");
	} else {
		const errorMessage = encodeURIComponent(result.error || "OAuth authentication failed");
		return c.redirect(`${origin}/login?error=${errorMessage}`);
	}
});

app.post("/session/exchange", async (c) => {
	c.header("Cache-Control", "no-store");
	const token = getCookie(c, "oauth_handoff");
	deleteCookie(c, "oauth_handoff", { path: "/api/oauth/session/exchange" });
	const session = token && (await verifyWebToken(token, c.env.JWT_SECRET).catch(() => null));
	if (
		!session ||
		!(await c.env.DB.prepare(
			"UPDATE web_sessions SET handoff_until=NULL WHERE id=? AND user_id=? AND handoff_until>unixepoch() RETURNING id",
		)
			.bind(session.id, session.userId)
			.first())
	)
		return c.json(
			{ success: false, error: { code: "INVALID_TOKEN", message: "Sign in again." } },
			401,
		);
	return c.json({ success: true, data: { token } });
});

export { app as oauthRoutes };
