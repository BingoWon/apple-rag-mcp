import { IconCopy } from "@tabler/icons-react";
import { type ReactNode, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { formatAdminDateTime, formatAdminResponseTime, getCountryFlag } from "@/lib/admin-utils";
import type { AdminLog, AdminLogKind } from "@/types/admin-logs";
import { copyText } from "@/utils/clipboard";
import { MCP_CLIENT_NAMES, reportedMCPClient } from "../../../shared/mcp-clients";
import { AdminUserLabel } from "./AdminUserLabel";
import { LogOutcome } from "./LogOutcome";

export function LogDetails({
	log,
	kind,
	onClose,
	onReturnFocus,
}: {
	log: AdminLog | null;
	kind: AdminLogKind;
	onClose: () => void;
	onReturnFocus: () => void;
}) {
	const { t } = useTranslation();
	const [copying, setCopying] = useState(false);
	const requested = log?.requested_url ?? log?.requested_query ?? "",
		actual = log?.actual_url ?? log?.actual_query ?? "";
	const copy = async (value: string) => {
		setCopying(true);
		try {
			await copyText(value);
			toast.success(t("common.copied"));
		} catch {
			toast.error(t("common.copy_failed"));
		} finally {
			setCopying(false);
		}
	};
	const reported = reportedMCPClient(log?.reported_client ?? null);
	const fields: [string, ReactNode][] = log
		? [
				["admin.col_created", `${formatAdminDateTime(log.created_at)} UTC+8`],
				["admin.col_time_s", formatAdminResponseTime(log.response_time_ms)],
				["admin.col_status", log.status_code],
				["admin.col_reason", log.reason],
				["admin.col_source", log.content_source ? t(`admin.source_${log.content_source}`) : null],
				["admin.col_provider", log.provider],
				["admin.col_upstream", log.upstream_status],
				[
					"admin.col_cache",
					kind === "fetch" ? t(log.cache_hit ? "admin.cache_hit" : "admin.cache_miss") : null,
				],
				["admin.col_results", log.result_count],
				["admin.col_user_name", <AdminUserLabel key="user" user={log.user} />],
				["admin.col_channel", t(`admin.channel_${log.channel}`)],
				["admin.col_credential", log.credential_id],
				["admin.col_session", log.session_id],
				["admin.col_auth_method", log.auth_method],
				["admin.col_request_id", log.request_id],
				["admin.reported_client", reported ? MCP_CLIENT_NAMES[reported] : null],
				["admin.col_client", log.client_name],
				["admin.col_client_version", log.client_version],
				[
					"admin.country",
					log.country_code ? `${getCountryFlag(log.country_code)} ${log.country_code}` : null,
				],
				["admin.col_id", log.id],
			]
		: [];
	return (
		<Dialog
			open={!!log}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					onReturnFocus();
				}}
				className="left-auto right-0 top-0 h-dvh max-h-dvh w-full max-w-xl translate-x-0 translate-y-0 rounded-none border-y-0 border-r-0 p-5 sm:p-6"
			>
				<DialogHeader>
					<DialogTitle>{t("admin.log_details")}</DialogTitle>
					<DialogDescription>{t("admin.log_details_desc")}</DialogDescription>
				</DialogHeader>
				{log && (
					<div className="space-y-6">
						<LogOutcome outcome={log.outcome} />
						{[
							[t(kind !== "search" ? "admin.requested_url" : "admin.requested_query"), requested],
							...(requested !== actual
								? [[t(kind !== "search" ? "admin.actual_url" : "admin.actual_query"), actual]]
								: []),
						].map(([label, value]) => (
							<section key={label} className="min-w-0 space-y-2">
								<div className="flex items-center justify-between gap-2">
									<h3 className="text-sm font-medium">{label}</h3>
									<Button
										variant="ghost"
										size="sm"
										disabled={copying || !value}
										onClick={() => copy(value)}
										aria-label={t("admin.copy_field", { field: label })}
									>
										<IconCopy className="mr-1 h-3.5 w-3.5" />
										{t("common.copy")}
									</Button>
								</div>
								<pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-xs leading-relaxed [overflow-wrap:anywhere]">
									{value || "—"}
								</pre>
							</section>
						))}
						<dl className="space-y-3">
							{fields
								.filter(([, v]) => v !== undefined)
								.map(([label, value]) => (
									<div
										key={label}
										className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 border-b border-border/50 pb-3 text-sm"
									>
										<dt className="text-subtle">{t(String(label))}</dt>
										<dd className="min-w-0 [overflow-wrap:anywhere]">{value ?? "—"}</dd>
									</div>
								))}
						</dl>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
