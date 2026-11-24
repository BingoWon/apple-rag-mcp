import type { TFunction } from "i18next";
import type { AdminUserIdentity } from "../../shared/admin-user";

export function adminUserName(user: AdminUserIdentity, t: TFunction): string {
	if (user.name) return user.name;
	return `${t(`admin.identity_${user.kind}`)}${user.kind === "anonymous" ? (user.ip_suffix ?? "") : ""}`;
}

const intervals: Record<string, string> = {
	week: "weekly",
	month: "monthly",
	"6 months": "semiannual",
	year: "annual",
};

export function formatAdminInterval(period: string, pass: boolean, t: TFunction) {
	const key = intervals[period];
	return key ? t(`pricing.${pass ? "onetime_" : ""}${key}`) : period;
}
