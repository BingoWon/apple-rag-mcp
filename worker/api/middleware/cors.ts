import type { Context, Next } from "hono";
import { cors } from "hono/cors";
import type { Env } from "../../shared/types.js";

function getAllowedOrigins(env: Env): string[] {
	return [env.FRONTEND_URL || "https://apple-rag.com", "http://localhost:4200"];
}

export function createCorsMiddleware(env: Env) {
	const allowedOrigins = getAllowedOrigins(env);

	return cors({
		origin: (origin) => {
			if (!origin) return origin;
			return allowedOrigins.includes(origin) ? origin : null;
		},
		allowHeaders: ["Content-Type", "Authorization", "X-Admin-Password"],
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
		exposeHeaders: ["X-Request-ID", "X-Response-Time"],
		maxAge: 86400,
		credentials: true,
	});
}

export const securityHeaders = async (c: Context<{ Bindings: Env }>, next: Next) => {
	await next();
	c.res.headers.set("X-Content-Type-Options", "nosniff");
	c.res.headers.set("X-Frame-Options", "DENY");
	c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	if (c.env.ENVIRONMENT === "production") {
		c.res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
	}
};
