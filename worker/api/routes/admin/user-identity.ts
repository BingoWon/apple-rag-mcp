import { z } from "zod";
import type { AdminUserIdentity } from "../../../shared/admin-user";
export const adminUserSchema = z.object({
	name: z.string().nullable(),
	kind: z.enum(["registered", "anonymous", "deleted"]),
	ip_suffix: z.string().nullable(),
});

const ipSchema = z.union([z.ipv4(), z.ipv6()]);

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
	return rows.map((row) => {
		const { user_id, user_ip, ...data } = row;
		const id = typeof user_id === "string" ? user_id : "";
		const kind: AdminUserIdentity["kind"] =
			!id || id.startsWith("anon_") ? "anonymous" : names.has(id) ? "registered" : "deleted";
		const name = names.get(id)?.trim();
		const ip = [user_ip, row.ip_address, id.startsWith("anon_") ? id.slice(5) : null]
			.filter((value): value is string => typeof value === "string")
			.map((value) => value.split(",")[0].trim())
			.find((value) => ipSchema.safeParse(value).success);
		return {
			...data,
			user: {
				name: name && !name.includes("@") ? name : null,
				kind,
				ip_suffix:
					kind === "anonymous" && ip
						? ip
								.replace(/[^a-z0-9]/gi, "")
								.toLowerCase()
								.slice(-6)
						: null,
			} satisfies AdminUserIdentity,
		};
	});
}
