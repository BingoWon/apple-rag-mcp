import { canonicalIP } from "../../shared/ip.js";
import { backgroundD1Write, type WaitUntilContext, withD1Timeout } from "./d1-utils.js";
import type { UserTokenData } from "./types.js";

interface UserRecord {
	user_id: string;
	email?: string;
	name?: string;
}

export class IPAuthenticationService {
	constructor(
		private d1: D1Database,
		private ctx: WaitUntilContext,
	) {}

	async checkIPAuthentication(clientIP: string): Promise<UserTokenData | null> {
		const ip = canonicalIP(clientIP);
		if (!ip) return null;
		const user = await withD1Timeout(() => this.queryIP(ip), "ip_auth");

		if (!user) return null;

		backgroundD1Write(this.ctx, () => this.updateLastUsed(ip, user.user_id), "ip_last_used");

		return {
			userId: user.user_id,
			email: user.email || "ip-authenticated",
			name: user.name || "IP User",
		};
	}

	private async queryIP(clientIP: string): Promise<UserRecord | null> {
		const result = await this.d1
			.prepare(
				`SELECT uai.user_id, u.email, u.name
         FROM user_authorized_ips uai
         JOIN users u ON uai.user_id = u.id
         WHERE uai.ip_address = ? LIMIT 2`,
			)
			.bind(clientIP)
			.all<UserRecord>();

		return result.results?.length === 1 ? result.results[0] : null;
	}

	private async updateLastUsed(ipAddress: string, userId: string): Promise<void> {
		await this.d1
			.prepare(
				"UPDATE user_authorized_ips SET last_used_at = ? WHERE ip_address = ? AND user_id = ?",
			)
			.bind(new Date().toISOString(), ipAddress, userId)
			.run();
	}
}
