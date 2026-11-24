import { backgroundD1Write, type WaitUntilContext, withD1Timeout } from "../services/d1-utils.js";
import { MCP_TOKEN_FORMAT, type UserTokenData } from "../services/types.js";

export interface TokenValidationResult {
	valid: boolean;
	error?: string;
	userData?: UserTokenData;
}

export class TokenValidator {
	constructor(
		private d1: D1Database,
		private ctx: WaitUntilContext,
	) {}

	async validateToken(token: string): Promise<TokenValidationResult> {
		if (!MCP_TOKEN_FORMAT.test(token)) {
			return { valid: false, error: "Invalid token format" };
		}

		const userData = await withD1Timeout(() => this.queryUserByToken(token), "token_lookup");

		if (!userData) {
			return { valid: false, error: "Token not found" };
		}

		backgroundD1Write(this.ctx, () => this.updateLastUsed(token), "token_last_used");

		return { valid: true, userData };
	}

	private async queryUserByToken(token: string): Promise<UserTokenData | null> {
		const result = await this.d1
			.prepare(
				`SELECT u.id as user_id, u.email, u.name, t.id as credential_id
         FROM mcp_tokens t JOIN users u ON t.user_id = u.id
         WHERE t.mcp_token = ?`,
			)
			.bind(token)
			.all();

		if (!result.success || !result.results?.length) return null;

		const row = result.results[0] as Record<string, unknown>;
		return {
			userId: row.user_id as string,
			email: (row.email as string) || "unknown",
			name: (row.name as string) || "unknown",
			credentialId: row.credential_id as string,
		};
	}

	private async updateLastUsed(token: string): Promise<void> {
		await this.d1
			.prepare("UPDATE mcp_tokens SET last_used_at = ? WHERE mcp_token = ?")
			.bind(new Date().toISOString(), token)
			.run();
	}
}
