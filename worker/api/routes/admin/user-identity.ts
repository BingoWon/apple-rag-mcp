import { z } from "zod";
import type { AdminSubscription, AdminUserIdentity } from "../../../shared/admin-user";
import { effectivePlanType } from "../../utils/subscription";
export const adminSubscriptionSchema = z.object({
	plan: z.enum(["hobby", "pro", "enterprise"]),
	billing_interval: z.string().nullable(),
	payment_type: z.string().nullable(),
});
export function adminSubscription(row: Record<string, unknown> | null): AdminSubscription {
	const plan = effectivePlanType(row);
	return {
		plan,
		billing_interval:
			plan !== "hobby" && row?.billing_interval ? String(row.billing_interval) : null,
		payment_type: plan !== "hobby" && row?.payment_type ? String(row.payment_type) : null,
	};
}
export const adminUserSchema = z.object({
	name: z.string().nullable(),
	kind: z.enum(["registered", "anonymous", "deleted"]),
	ip_suffix: z.string().nullable(),
	subscription: adminSubscriptionSchema,
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
					.prepare(
						`SELECT u.id,u.name,s.plan_type,s.status,s.payment_type,s.billing_interval,s.current_period_end FROM users u LEFT JOIN user_subscriptions s ON s.user_id=u.id WHERE u.id IN (${ids.map(() => "?").join(",")})`,
					)
					.bind(...ids)
					.all<Record<string, unknown> & { id: string; name: string }>()
			).results
		: [];
	const usersById = new Map(users.map((user) => [user.id, user]));
	return rows.map((row) => {
		const { user_id, user_ip, ...data } = row;
		const id = typeof user_id === "string" ? user_id : "";
		const kind: AdminUserIdentity["kind"] =
			!id || id.startsWith("anon_") ? "anonymous" : usersById.has(id) ? "registered" : "deleted";
		const account = usersById.get(id);
		const name = account?.name?.trim();
		const ip = [user_ip, row.ip_address, id.startsWith("anon_") ? id.slice(5) : null]
			.filter((value): value is string => typeof value === "string")
			.map((value) => value.split(",")[0].trim())
			.find((value) => ipSchema.safeParse(value).success);
		return {
			...data,
			user: {
				name: name && !name.includes("@") ? name : null,
				kind,
				subscription: adminSubscription(account ?? null),
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
