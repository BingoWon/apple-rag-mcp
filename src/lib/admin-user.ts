import type { TFunction } from "i18next";
import type { AdminUserIdentity } from "../../worker/shared/admin-user";

export function adminUserName(user: AdminUserIdentity, t: TFunction): string {
	if (user.name) return user.name;
	const colors = t("admin.visitor_colors", { returnObjects: true }) as string[];
	const animals = t("admin.visitor_animals", { returnObjects: true }) as string[];
	const nickname = `${colors[Number.parseInt(user.alias.slice(0, 2), 16) % colors.length]} ${animals[Number.parseInt(user.alias.slice(2, 4), 16) % animals.length]}`;
	const number = (Number.parseInt(user.alias.slice(4), 16) % 100000000).toString().padStart(8, "0");
	return `${t(`admin.identity_${user.kind}`)} · ${nickname} ${number}`;
}
