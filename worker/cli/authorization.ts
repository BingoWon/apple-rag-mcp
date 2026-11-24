import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import {
	CLI_CLIENT_ID,
	CLI_RESOURCE,
	CLI_SCOPE,
	type CLICredentials,
} from "../../shared/contracts.js";
import { hashString } from "../api/utils/security.js";
import { withD1Timeout } from "../services/d1-utils.js";
import type { AuthContext } from "../services/types.js";

const ACCESS_MS = 15 * 60_000;
const SESSION_MS = 30 * 86400_000;
const REQUEST_MS = 10 * 60_000;
const nameSchema = z.string().trim().min(1).max(80);
interface Authorization {
	id: string;
	kind: "code" | "device";
	client_id: string;
	device_name: string;
	status: "pending" | "approved" | "denied";
	user_id: string | null;
	code_challenge: string | null;
	redirect_uri: string | null;
	state: string | null;
	expires_at: number;
	next_poll_at: number;
}
interface Session {
	id: string;
	user_id: string;
	kind: "device" | "api_key";
	name: string;
	refresh_token_hash: string | null;
	expires_at: number;
	revoked_at: number | null;
	email?: string;
}
export class OAuthError extends Error {
	constructor(
		readonly error: string,
		message: string,
		readonly status = 400,
	) {
		super(message);
	}
}
const invalid = () =>
	new OAuthError("invalid_grant", "The authorization has expired, was revoked or is not valid.");
export function randomSecret(): string {
	return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
}
export async function challenge(verifier: string): Promise<string> {
	const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
	return btoa(String.fromCharCode(...new Uint8Array(bytes)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");
}
export function loopbackRedirect(value: string): string {
	let u: URL;
	try {
		u = new URL(value);
	} catch {
		throw new OAuthError("invalid_request", "Invalid callback URL.");
	}
	if (
		u.protocol !== "http:" ||
		!["127.0.0.1", "[::1]"].includes(u.hostname) ||
		!u.port ||
		u.pathname !== "/callback" ||
		u.username ||
		u.password ||
		u.search ||
		u.hash
	)
		throw new OAuthError(
			"invalid_request",
			"Use an HTTP loopback IP callback at /callback with an explicit port.",
		);
	return u.href;
}
export class CLIAuthorization {
	constructor(
		private db: D1Database,
		private secret: string | undefined,
		readonly origin: string,
	) {}
	private async first<T>(sql: string, ...values: (string | number | null)[]): Promise<T | null> {
		return withD1Timeout(
			() =>
				this.db
					.prepare(sql)
					.bind(...values)
					.first<T>(),
			"cli_auth",
		);
	}
	private async run(sql: string, ...values: (string | number | null)[]): Promise<void> {
		const result = await withD1Timeout(
			() =>
				this.db
					.prepare(sql)
					.bind(...values)
					.run(),
			"cli_auth_write",
		);
		if (!result.success) throw new Error("CLI authorization state could not be saved.");
	}
	private async key(): Promise<Uint8Array> {
		if (!this.secret) throw new Error("CLI authorization is unavailable.");
		const key = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(this.secret),
			"HKDF",
			false,
			["deriveBits"],
		);
		return new Uint8Array(
			await crypto.subtle.deriveBits(
				{
					name: "HKDF",
					hash: "SHA-256",
					salt: new TextEncoder().encode("apple-rag-cli"),
					info: new TextEncoder().encode("oauth-v1"),
				},
				key,
				256,
			),
		);
	}
	private validateClient(input: Record<string, unknown>): void {
		if (input.client_id !== CLI_CLIENT_ID)
			throw new OAuthError("invalid_client", "Unknown CLI client.");
		if (input.scope !== undefined && input.scope !== CLI_SCOPE)
			throw new OAuthError("invalid_scope", `Expected CLI scope: ${CLI_SCOPE}.`);
		if (input.resource !== undefined && input.resource !== this.origin + CLI_RESOURCE)
			throw new OAuthError("invalid_target", "The credential is only for the CLI API.");
	}
	async rateLimit(ip: string, bucket: string, limit: number): Promise<void> {
		const now = Date.now(),
			window = Math.floor(now / 60000),
			id = `${bucket}:${ip}:${window}`;
		const row = await this.first<{ count: number }>(
			"INSERT INTO cli_auth_limits(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 WHERE count<? RETURNING count",
			id,
			(window + 2) * 60000,
			limit,
		);
		if (!row)
			throw new OAuthError("slow_down", "Too many authorization attempts. Wait one minute.", 429);
	}
	async start(input: Record<string, unknown>, kind: "code" | "device") {
		this.validateClient(input);
		const name = nameSchema.parse(input.device_name ?? "Apple RAG CLI");
		let redirect: string | null = null,
			codeChallenge: string | null = null,
			state: string | null = null;
		if (kind === "code") {
			if (input.response_type !== "code" || input.code_challenge_method !== "S256")
				throw new OAuthError("invalid_request", "Authorization code with S256 PKCE is required.");
			redirect = loopbackRedirect(z.string().parse(input.redirect_uri));
			codeChallenge = z
				.string()
				.regex(/^[A-Za-z0-9_-]{43}$/)
				.parse(input.code_challenge);
			state = z.string().min(20).max(256).parse(input.state);
		}
		const id = randomSecret(),
			device = kind === "device" ? randomSecret() : null;
		const alphabet = "BCDFGHJKLMNPQRSTVWXZ23456789";
		const chars = crypto.getRandomValues(new Uint8Array(10));
		const code =
			kind === "device" ? Array.from(chars, (c) => alphabet[c % alphabet.length]).join("") : null;
		const userCode = code ? `${code.slice(0, 5)}-${code.slice(5)}` : null;
		await this.run(
			"INSERT INTO cli_authorizations(id,kind,client_id,device_name,device_code_hash,user_code_hash,code_challenge,redirect_uri,state,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
			id,
			kind,
			CLI_CLIENT_ID,
			name,
			device ? await hashString(device) : null,
			code ? await hashString(code) : null,
			codeChallenge,
			redirect,
			state,
			Date.now() + REQUEST_MS,
			Date.now(),
		);
		const uri = `${this.origin}/cli/authorize`;
		return kind === "device"
			? {
					device_code: device!,
					user_code: userCode!,
					verification_uri: uri,
					verification_uri_complete: `${uri}?user_code=${userCode}`,
					expires_in: REQUEST_MS / 1000,
					interval: 5,
				}
			: { authorization_url: `${uri}?request=${id}` };
	}
	private async authorization(id?: string, userCode?: string): Promise<Authorization> {
		const row = id
			? await this.first<Authorization>("SELECT * FROM cli_authorizations WHERE id=?", id)
			: await this.first<Authorization>(
					"SELECT * FROM cli_authorizations WHERE user_code_hash=?",
					await hashString((userCode ?? "").toUpperCase().replace(/-/g, "")),
				);
		if (!row || row.expires_at <= Date.now()) throw invalid();
		return row;
	}
	async describe(id?: string, userCode?: string) {
		const row = await this.authorization(id, userCode);
		return {
			client_name: "Apple RAG CLI",
			device_name: row.device_name,
			kind: row.kind,
			status: row.status,
			scope: CLI_SCOPE,
			expires_at: new Date(row.expires_at).toISOString(),
		};
	}
	async decide(userId: string, approve: boolean, id?: string, userCode?: string) {
		const row = await this.authorization(id, userCode);
		const code = approve && row.kind === "code" ? randomSecret() : null;
		const changed = await this.first<{ id: string }>(
			"UPDATE cli_authorizations SET status=?,user_id=?,code_hash=?,expires_at=? WHERE id=? AND status='pending' AND expires_at>? RETURNING id",
			approve ? "approved" : "denied",
			userId,
			code ? await hashString(code) : null,
			row.kind === "code" ? Math.min(row.expires_at, Date.now() + 180000) : row.expires_at,
			row.id,
			Date.now(),
		);
		if (!changed)
			throw new OAuthError(
				"invalid_request",
				"This authorization request has already been handled.",
				409,
			);
		let redirect: string | undefined;
		if (row.kind === "code") {
			const target = new URL(row.redirect_uri!);
			target.searchParams.set(approve ? "code" : "error", approve ? code! : "access_denied");
			target.searchParams.set("state", row.state!);
			target.searchParams.set("iss", this.origin);
			redirect = target.href;
		}
		return { approved: approve, redirect_uri: redirect };
	}
	private async pair(session: Session): Promise<CLICredentials> {
		const key = await this.key(),
			now = Math.floor(Date.now() / 1000);
		const common = {
			sub: session.user_id,
			sid: session.id,
			client_id: CLI_CLIENT_ID,
			scope: CLI_SCOPE,
		};
		const access = await new SignJWT(common)
			.setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
			.setIssuer(this.origin)
			.setAudience(this.origin + CLI_RESOURCE)
			.setIssuedAt(now)
			.setExpirationTime(now + ACCESS_MS / 1000)
			.sign(key);
		const refresh = await new SignJWT(common)
			.setProtectedHeader({ alg: "HS256", typ: "rt+jwt" })
			.setIssuer(this.origin)
			.setAudience(this.origin + CLI_RESOURCE)
			.setIssuedAt(now)
			.setJti(crypto.randomUUID())
			.setExpirationTime(Math.floor(session.expires_at / 1000))
			.sign(key);
		return {
			access_token: `ar_cli_a_${access}`,
			refresh_token: `ar_cli_r_${refresh}`,
			expires_at: new Date((now + ACCESS_MS / 1000) * 1000).toISOString(),
			expires_in: ACCESS_MS / 1000,
			token_type: "Bearer",
			scope: CLI_SCOPE,
		};
	}
	private async verify(token: string, kind: "a" | "r") {
		if (!token.startsWith(`ar_cli_${kind}_`)) throw invalid();
		try {
			const result = await jwtVerify(token.slice(9), await this.key(), {
				algorithms: ["HS256"],
				issuer: this.origin,
				audience: this.origin + CLI_RESOURCE,
				typ: kind === "a" ? "at+jwt" : "rt+jwt",
			});
			const p = result.payload;
			if (
				typeof p.sub !== "string" ||
				typeof p.sid !== "string" ||
				p.client_id !== CLI_CLIENT_ID ||
				p.scope !== CLI_SCOPE ||
				typeof p.exp !== "number"
			)
				throw invalid();
			return { userId: p.sub, sessionId: p.sid };
		} catch {
			throw invalid();
		}
	}
	async exchange(input: Record<string, unknown>): Promise<CLICredentials> {
		this.validateClient(input);
		if (input.grant_type === "refresh_token")
			return this.refresh(z.string().parse(input.refresh_token));
		let row: Authorization | null = null;
		if (input.grant_type === "authorization_code") {
			const code = z.string().min(20).max(200).parse(input.code);
			row = await this.first<Authorization>(
				"SELECT * FROM cli_authorizations WHERE code_hash=?",
				await hashString(code),
			);
			if (
				row?.kind !== "code" ||
				row.redirect_uri !== input.redirect_uri ||
				!z
					.string()
					.regex(/^[A-Za-z0-9._~-]{43,128}$/)
					.safeParse(input.code_verifier).success ||
				(await challenge(input.code_verifier as string)) !== row.code_challenge
			)
				throw invalid();
		} else if (input.grant_type === "urn:ietf:params:oauth:grant-type:device_code") {
			const code = z.string().min(20).max(200).parse(input.device_code);
			row = await this.first<Authorization>(
				"SELECT * FROM cli_authorizations WHERE device_code_hash=?",
				await hashString(code),
			);
			if (row?.kind !== "device" || row.expires_at <= Date.now())
				throw new OAuthError("expired_token", "The device authorization has expired.");
			const poll = await this.first<{ id: string }>(
				"UPDATE cli_authorizations SET next_poll_at=? WHERE id=? AND next_poll_at<=? RETURNING id",
				Date.now() + 5000,
				row.id,
				Date.now(),
			);
			if (!poll) throw new OAuthError("slow_down", "Wait before polling again.");
			if (row.status === "pending")
				throw new OAuthError("authorization_pending", "Waiting for browser approval.");
		} else throw new OAuthError("unsupported_grant_type", "Unsupported CLI authorization grant.");
		if (!row || row.expires_at <= Date.now()) throw invalid();
		if (row.status === "denied")
			throw new OAuthError("access_denied", "The authorization was declined.");
		if (row.status !== "approved" || !row.user_id) throw invalid();
		const session: Session = {
			id: crypto.randomUUID(),
			user_id: row.user_id,
			kind: "device",
			name: row.device_name,
			refresh_token_hash: null,
			expires_at: Date.now() + SESSION_MS,
			revoked_at: null,
		};
		const pair = await this.pair(session);
		const refreshHash = await hashString(pair.refresh_token!);
		const consumeTime = Date.now();
		const results = await withD1Timeout(
			() =>
				this.db.batch([
					this.db
						.prepare(
							"INSERT INTO cli_sessions(id,user_id,kind,name,refresh_token_hash,expires_at,created_at) SELECT ?,user_id,'device',device_name,?,?,? FROM cli_authorizations WHERE id=? AND status='approved' AND expires_at>? AND (SELECT count(*) FROM cli_sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at>?)<20",
						)
						.bind(
							session.id,
							refreshHash,
							session.expires_at,
							consumeTime,
							row.id,
							consumeTime,
							row.user_id,
							consumeTime,
						),
					this.db
						.prepare(
							"DELETE FROM cli_authorizations WHERE id=? AND status='approved' AND expires_at>? AND EXISTS(SELECT 1 FROM cli_sessions WHERE id=?) RETURNING id",
						)
						.bind(row.id, consumeTime, session.id),
				]),
			"cli_authorization_consume",
		);
		if (!results.every((result) => result.success))
			throw new Error("CLI authorization could not be saved.");
		if (results[1].results?.length !== 1) {
			if ((await this.list(row.user_id)).length >= 20)
				throw new OAuthError(
					"access_denied",
					"Revoke an existing CLI device or key in website settings first.",
					409,
				);
			throw invalid();
		}
		return pair;
	}
	private async refresh(token: string): Promise<CLICredentials> {
		const claims = await this.verify(token, "r");
		const session = await this.first<Session>(
			"SELECT * FROM cli_sessions WHERE id=? AND user_id=? AND kind='device' AND revoked_at IS NULL AND expires_at>?",
			claims.sessionId,
			claims.userId,
			Date.now(),
		);
		if (!session) throw invalid();
		const hash = await hashString(token);
		if (hash !== session.refresh_token_hash) {
			await this.revokeSession(session.id, session.user_id);
			throw invalid();
		}
		const pair = await this.pair(session);
		const changed = await this.first<{ id: string }>(
			"UPDATE cli_sessions SET refresh_token_hash=? WHERE id=? AND refresh_token_hash=? AND revoked_at IS NULL RETURNING id",
			await hashString(pair.refresh_token!),
			session.id,
			hash,
		);
		if (!changed) {
			await this.revokeSession(session.id, session.user_id);
			throw invalid();
		}
		return pair;
	}
	async authenticate(request: Request): Promise<AuthContext> {
		const header = request.headers.get("Authorization");
		if (header === null) return { isAuthenticated: false, authMethod: "anonymous" };
		const token = /^Bearer (\S+)$/i.exec(header)?.[1];
		if (!token) throw new OAuthError("invalid_token", "Invalid CLI credential.", 401);
		return this.authenticateToken(token);
	}
	private async authenticateToken(token: string): Promise<AuthContext> {
		let session: Session | null;
		try {
			if (token.startsWith("ar_cli_a_")) {
				const c = await this.verify(token, "a");
				session = await this.first<Session>(
					"SELECT s.*,u.email FROM cli_sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.user_id=? AND s.kind='device' AND s.revoked_at IS NULL AND s.expires_at>?",
					c.sessionId,
					c.userId,
					Date.now(),
				);
			} else if (/^ar_cli_k_[A-Za-z0-9_-]{43}$/.test(token)) {
				session = await this.first<Session>(
					"SELECT s.*,u.email FROM cli_sessions s JOIN users u ON u.id=s.user_id WHERE s.access_token_hash=? AND s.kind='api_key' AND s.revoked_at IS NULL AND s.expires_at>?",
					await hashString(token),
					Date.now(),
				);
			} else throw invalid();
		} catch (error) {
			if (error instanceof OAuthError)
				throw new OAuthError("invalid_token", "CLI credential rejected. Sign in again.", 401);
			throw error;
		}
		if (!session)
			throw new OAuthError("invalid_token", "CLI credential rejected. Sign in again.", 401);
		return {
			isAuthenticated: true,
			userId: session.user_id,
			email: session.email,
			credentialId: session.id,
			sessionId: session.kind === "device" ? session.id : undefined,
			authMethod: session.kind === "device" ? "oauth" : "api_key",
		};
	}
	async createKey(userId: string, name: string, days: number) {
		name = nameSchema.parse(name);
		days = z.number().int().min(1).max(90).parse(days);
		const token = `ar_cli_k_${randomSecret()}`,
			id = crypto.randomUUID(),
			expires = Date.now() + days * 86400000;
		const created = await this.first<{ id: string }>(
			"INSERT INTO cli_sessions(id,user_id,kind,name,access_token_hash,expires_at,created_at) SELECT ?,?,'api_key',?,?,?,? WHERE (SELECT count(*) FROM cli_sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at>?)<20 RETURNING id",
			id,
			userId,
			name,
			await hashString(token),
			expires,
			Date.now(),
			userId,
			Date.now(),
		);
		if (!created)
			throw new OAuthError("session_limit", "Revoke an existing CLI device or key first.", 409);
		return { id, token, expires_at: new Date(expires).toISOString() };
	}
	async list(userId: string) {
		const rows = await withD1Timeout(
			() =>
				this.db
					.prepare(
						"SELECT id,kind,name,expires_at,revoked_at,created_at FROM cli_sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at>? ORDER BY created_at DESC",
					)
					.bind(userId, Date.now())
					.all(),
			"cli_sessions_list",
		);
		if (!rows.success) throw new Error("CLI sessions unavailable.");
		return rows.results;
	}
	async revokeSession(id: string, userId: string) {
		await this.run(
			"UPDATE cli_sessions SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL",
			Date.now(),
			id,
			userId,
		);
	}
	async revoke(token: string) {
		try {
			if (token.startsWith("ar_cli_r_")) {
				const c = await this.verify(token, "r");
				await this.revokeSession(c.sessionId, c.userId);
			} else {
				const auth = await this.authenticateToken(token);
				if (auth.credentialId && auth.userId)
					await this.revokeSession(auth.credentialId, auth.userId);
			}
		} catch (error) {
			if (!(error instanceof OAuthError)) throw error;
		}
	}
	async cleanup() {
		await this.run("DELETE FROM cli_authorizations WHERE expires_at<?", Date.now());
		await this.run("DELETE FROM cli_auth_limits WHERE expires_at<?", Date.now());
		await this.run(
			"DELETE FROM cli_sessions WHERE expires_at<? OR revoked_at<?",
			Date.now() - 7 * 86400000,
			Date.now() - 7 * 86400000,
		);
	}
}
