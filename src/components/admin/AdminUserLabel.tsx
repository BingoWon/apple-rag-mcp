import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/Badge";
import { adminUserName } from "@/lib/admin-user";
import type { AdminSubscription, AdminUserIdentity } from "../../../worker/shared/admin-user";

const intervals: Record<string, string> = {
	week: "weekly",
	month: "monthly",
	"6 months": "semiannual",
	year: "annual",
};

export function AdminPlanBadge({ subscription }: { subscription: AdminSubscription }) {
	const { t } = useTranslation();
	const paid = subscription.plan !== "hobby";
	const period = subscription.billing_interval;
	const key = period ? intervals[period] : undefined;
	const interval = key
		? t(`pricing.${subscription.payment_type === "one_time" ? "onetime_" : ""}${key}`)
		: period;
	const plan = subscription.plan === "enterprise" ? "Enterprise" : paid ? "Pro" : "Free";
	return (
		<Badge
			variant={paid ? "secondary" : "outline"}
			title={t("admin.current_user_plan")}
			className={`shrink-0 rounded px-1.5 py-0 text-[10px] leading-5 transition-none ${paid ? "bg-brand/10 text-brand-tertiary dark:text-brand" : ""}`}
		>
			{plan}
			{paid && interval ? ` · ${interval}` : ""}
		</Badge>
	);
}

export function AdminUserLabel({ user }: { user: AdminUserIdentity }) {
	const { t } = useTranslation();
	return (
		<div className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1">
			<span className="min-w-0 break-words">{adminUserName(user, t)}</span>
			{user.kind !== "deleted" && <AdminPlanBadge subscription={user.subscription} />}
		</div>
	);
}
