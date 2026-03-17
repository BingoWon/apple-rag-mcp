/**
 * CORS 中间件
 * 处理跨域请求，支持 MCP 服务和前端应用的跨域访问
 */
import type { Context, Next } from "hono";
import { cors } from "hono/cors";
import type { Env } from "../types/env";

/**
 * 获取允许的源域名列表
 */
function getAllowedOrigins(env: Env): string[] {
	return [
		env.FRONTEND_URL || "https://apple-rag.com",
		"http://localhost:4200",
		"http://127.0.0.1:4200",
	];
}

/**
 * 创建 CORS 中间件
 */
export function createCorsMiddleware(env: Env) {
	const allowedOrigins = getAllowedOrigins(env);

	return cors({
		origin: (origin) => {
			// 允许无 origin 的请求（如 Postman、curl 等）
			if (!origin) return origin;

			// 检查是否在允许列表中
			return allowedOrigins.includes(origin) ? origin : null;
		},
		allowHeaders: [
			"Content-Type",
			"Authorization",
			"X-API-Key",
			"X-Admin-Password",
			"X-Requested-With",
			"Accept",
			"Origin",
			"User-Agent",
		],
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
		exposeHeaders: [
			"X-Request-ID",
			"X-Response-Time",
			"X-Rate-Limit-Remaining",
			"X-Rate-Limit-Reset",
		],
		maxAge: 86400, // 24 hours
		credentials: true,
	});
}

/**
 * 预检请求处理中间件
 */
export const preflightHandler = async (c: Context<{ Bindings: Env }>, next: Next) => {
	// 处理 OPTIONS 预检请求
	if (c.req.method === "OPTIONS") {
		const origin = c.req.header("Origin");
		const allowedOrigins = getAllowedOrigins(c.env);

		if (origin && allowedOrigins.includes(origin)) {
			return new Response(null, {
				status: 204,
				headers: {
					"Access-Control-Allow-Origin": origin,
					"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
					"Access-Control-Allow-Headers":
						"Content-Type, Authorization, X-API-Key, X-Admin-Password, X-Requested-With, Accept, Origin, User-Agent",
					"Access-Control-Allow-Credentials": "true",
					"Access-Control-Max-Age": "86400",
				},
			});
		}
	}

	await next();
};

/**
 * 安全头部中间件
 */
export const securityHeadersMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
	await next();

	// 添加安全相关的 HTTP 头部
	c.res.headers.set("X-Content-Type-Options", "nosniff");
	c.res.headers.set("X-Frame-Options", "DENY");
	c.res.headers.set("X-XSS-Protection", "1; mode=block");
	c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

	// 生产环境添加更严格的安全头部
	const isProduction = c.env.ENVIRONMENT === "production";
	if (isProduction) {
		c.res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
		c.res.headers.set(
			"Content-Security-Policy",
			"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'",
		);
	}
};

// 注意：requestId 和 responseTime 中间件已移除
// 现在使用 Hono 内置的 requestId() 和 timing() 中间件
