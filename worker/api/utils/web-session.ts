import { jwtVerify, SignJWT } from "jose";
import type { User } from "../types";

const audience = "apple-rag-website";
const lifetime = 24 * 60 * 60;
function key(secret: string) {
	if (!secret) throw Error("Website authentication is not configured");
	return new TextEncoder().encode(secret);
}

export async function issueWebSession(
	db: D1Database,
	user: User,
	plan: string,
	permissions: string[],
	secret: string,
	{ handoff = false, writeUser }: { handoff?: boolean; writeUser?: D1PreparedStatement } = {},
) {
	const id = crypto.randomUUID();
	const exp = Math.floor(Date.now() / 1000) + lifetime;
	const token = await new SignJWT({
		email: user.email,
		name: user.name,
		avatar: user.avatar,
		created_at: user.created_at,
		plan_type: plan,
		permissions,
	})
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.setAudience(audience)
		.setSubject(user.id)
		.setJti(id)
		.setIssuedAt()
		.setExpirationTime(exp)
		.sign(key(secret));
	const session = db
		.prepare(`INSERT INTO web_sessions(id,user_id,expires_at,handoff_until)
 VALUES(?,(SELECT id FROM users WHERE id=? AND (provider!='email' OR password_hash IS ?)),?,?)`)
		.bind(
			id,
			user.id,
			user.password_hash ?? null,
			exp,
			handoff ? Math.floor(Date.now() / 1000) + 60 : null,
		);
	if (writeUser) await db.batch([writeUser, session]);
	else await session.run();
	return { token, expires_at: new Date(exp * 1000).toISOString() };
}

export async function verifyWebToken(token: string, secret: string) {
	const { payload } = await jwtVerify(token, key(secret), {
		audience,
		algorithms: ["HS256"],
		requiredClaims: ["iat", "exp", "sub", "jti"],
	});
	if (!payload.sub || !payload.jti) throw Error("Invalid web session");
	return { userId: payload.sub, id: payload.jti };
}
