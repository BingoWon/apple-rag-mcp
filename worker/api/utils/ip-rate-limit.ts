import { withD1Timeout } from "../../services/d1-utils.js";

/**
 * Fixed-window IP rate limiter backed by the existing `cli_auth_limits` D1 table
 * (automatically pruned by the scheduled cleanup job).
 */
export async function checkIpRateLimit(
	db: D1Database,
	ip: string,
	bucket: string,
	limit: number,
	windowMs = 60_000,
): Promise<boolean> {
	const now = Date.now();
	const window = Math.floor(now / windowMs);
	const id = `api:${bucket}:${ip}:${window}`;
	const row = await withD1Timeout(
		() =>
			db
				.prepare(
					"INSERT INTO cli_auth_limits(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 WHERE count<? RETURNING count",
				)
				.bind(id, (window + 2) * windowMs, limit)
				.first<{ count: number }>(),
		`rate_limit_${bucket}`,
	);
	return row !== null;
}
