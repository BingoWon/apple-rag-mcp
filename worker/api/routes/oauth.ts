/**
 * OAuth Authentication Routes
 * Unified OAuth handling for Google and GitHub
 */
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { OAuthService } from "../services/oauth-service";
import type { AppEnv } from "../types/hono";

const app = new OpenAPIHono<AppEnv>();

// Unified OAuth provider type
const OAuthProvider = z.enum(["google", "github"]);

// Unified OAuth request schema
const OAuthRequestSchema = z.object({
	state: z.string().optional(),
});

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
		param: z.object({
			provider: OAuthProvider,
		}),
		body: {
			content: {
				"application/json": {
					schema: OAuthRequestSchema,
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
	const provider = c.req.param("provider") as "google" | "github";
	const { state } = c.req.valid("json");
	const oauthService = new OAuthService(c.env);

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
		param: z.object({
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
	const provider = c.req.param("provider") as "google" | "github";
	const { code } = c.req.valid("query");
	const oauthService = new OAuthService(c.env);

	// Get request info for session management
	const userAgent = c.req.header("User-Agent");
	const ipAddress = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For");

	const result = await oauthService.handleCallback(provider, code, userAgent, ipAddress);

	if (result.success && result.data) {
		// Redirect to frontend with authentication data
		const frontendUrl = c.env.FRONTEND_URL || "https://apple-rag.com";

		const authData = {
			userId: result.data.user.id,
			email: result.data.user.email,
			name: result.data.user.name,
			avatar: result.data.user.avatar,
			plan_type: result.data.user.plan_type || "hobby",
			jwtToken: result.data.jwtToken,
		};

		const redirectUrl = `${frontendUrl}/overview?auth=${encodeURIComponent(btoa(JSON.stringify(authData)))}`;
		return c.redirect(redirectUrl);
	} else {
		const frontendUrl = c.env.FRONTEND_URL || "https://apple-rag.com";
		const errorMessage = encodeURIComponent(result.error || "OAuth authentication failed");
		return c.redirect(`${frontendUrl}/login?error=${errorMessage}`);
	}
});

export { app as oauthRoutes };
