import { z } from "zod";
import type { AdminUserIdentity } from "../../../shared/admin-user";
export const adminUserSchema = z.object({
	name: z.string().nullable(),
	kind: z.enum(["registered", "anonymous", "deleted"]),
	alias: z.string(),
});

// Resolve one page in one query; internal identifiers never become display names.
export async function withAdminUsers<T extends Record<string, unknown>>(db: D1Database, rows: T[]) {
	const ids = [
		...new Set(
			rows
				.map((row) => row.user_id)
				.filter((id): id is string => typeof id === "string" && !id.startsWith("anon_")),
		),
	];
	const users = ids.length
		? (
				await db
					.prepare(`SELECT id,name FROM users WHERE id IN (${ids.map(() => "?").join(",")})`)
					.bind(...ids)
					.all<{ id: string; name: string }>()
			).results
		: [];
	const names = new Map(users.map((user) => [user.id, user.name]));
	return Promise.all(
		rows.map(async (row) => {
			const { user_id, ...data } = row;
			const id = typeof user_id === "string" ? user_id : "";
			const kind: AdminUserIdentity["kind"] =
				!id || id.startsWith("anon_") ? "anonymous" : names.has(id) ? "registered" : "deleted";
			const name = names.get(id)?.trim();
			const seed = id || String(row.ip_address || row.id);
			const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
			const alias = Array.from(new Uint8Array(digest).slice(0, 6), (byte) =>
				byte.toString(16).padStart(2, "0"),
			).join("");
			return {
				...data,
				user: {
					name: name && !name.includes("@") ? name : null,
					kind,
					alias,
				} satisfies AdminUserIdentity,
			};
		}),
	);
}
