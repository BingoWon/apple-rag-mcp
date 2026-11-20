import type { Context, Next } from "hono";
import type { User } from "../types";
import type { AppEnv } from "../types/hono";
import { verifyWebToken } from "../utils/web-session";

async function webIdentity(c: Context<AppEnv>, next: Next, optional: boolean) {
	const header = c.req.header("Authorization");
	if (header === undefined && optional) return next();
	const token = header?.match(/^Bearer (\S+)$/i)?.[1];
	const session = token ? await verifyWebToken(token, c.env.JWT_SECRET).catch(() => null) : null;
	if (!session)
		return c.json(
			{ success: false, error: { code: "INVALID_TOKEN", message: "Sign in again." } },
			401,
		);
	const user = await c.env.DB.prepare(
		"SELECT u.id,u.email,u.name,u.avatar,u.provider,u.created_at,u.updated_at FROM users u JOIN web_sessions s ON s.user_id=u.id WHERE u.id=? AND s.id=? AND s.expires_at>unixepoch() AND s.handoff_until IS NULL",
	)
		.bind(session.userId, session.id)
		.first<User>();
	if (!user)
		return c.json(
			{ success: false, error: { code: "INVALID_TOKEN", message: "Sign in again." } },
			401,
		);
	c.set("user", user);
	c.set("userId", user.id);
	c.set("webSessionId", session.id);
	await next();
}
export const authMiddleware = (c: Context<AppEnv>, next: Next) => webIdentity(c, next, false);
export const optionalAuthMiddleware = (c: Context<AppEnv>, next: Next) =>
	webIdentity(c, next, true);
