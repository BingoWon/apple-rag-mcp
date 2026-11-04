import type { TFunction } from "i18next";
import type { AdminUserIdentity } from "../../worker/shared/admin-user";

export function adminUserName(user: AdminUserIdentity, t: TFunction): string {
	if (user.name) return user.name;
	return `${t(`admin.identity_${user.kind}`)}${user.kind === "anonymous" ? (user.ip_suffix ?? "") : ""}`;
}
