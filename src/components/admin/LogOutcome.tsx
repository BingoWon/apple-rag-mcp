import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/Badge";
import type { ToolOutcome } from "../../../worker/shared/tool-outcomes";

const variants = {
	success: "success",
	degraded: "secondary",
	no_content: "outline",
	limited: "warning",
	invalid: "outline",
	failed: "destructive",
	cancelled: "outline",
	unknown: "outline",
} as const;
export function LogOutcome({ outcome }: { outcome: ToolOutcome }) {
	const { t } = useTranslation();
	return (
		<Badge variant={variants[outcome]} className="w-fit whitespace-nowrap">
			{t(`admin.stats_${outcome}`)}
		</Badge>
	);
}
