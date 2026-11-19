import { IconArrowUpRight } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { AdminDashboardStats } from "@/types";
import { TOOL_KINDS, type ToolKind } from "../../../shared/tool-activity";
import { TOOL_OUTCOMES } from "../../../worker/shared/tool-outcomes";
import { OUTCOME_COLORS, TrendChart } from "../charts/TrendChart";
import { TOOL_COLORS } from "../charts/tool-series";
import { Card } from "../ui/Card";

const metricKeys = { search: "searches", fetch: "fetches", browse: "browses" } as const;
export function ToolActivityCard({
	stats,
	loading,
	detailQuery,
}: {
	stats: AdminDashboardStats | null;
	loading: boolean;
	detailQuery: string;
}) {
	const { t, i18n } = useTranslation();
	const [selected, setSelected] = useState<ToolKind | null>(null);
	const format = (n: number | undefined) =>
		n === undefined ? "--" : n.toLocaleString(i18n.resolvedLanguage);
	const total = stats
		? TOOL_KINDS.reduce((sum, k) => sum + stats.metrics[metricKeys[k]].total, 0)
		: undefined;
	const active = selected && stats ? stats.metrics[metricKeys[selected]] : null;
	return (
		<Card className="min-w-0 p-4 md:col-span-2 xl:col-span-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h3 className="text-sm font-semibold text-light">
					{t("activity.tool_calls")}
					<span className="ml-2 text-xl tabular-nums">{format(active?.total ?? total)}</span>
				</h3>
				<button
					type="button"
					aria-pressed={!selected}
					className="rounded-md border border-default px-3 py-1.5 text-xs font-medium text-muted aria-pressed:text-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
					onClick={() => setSelected(null)}
				>
					{t("activity.all_tools")}
				</button>
			</div>
			<p className="my-2 text-xs text-muted">
				{selected
					? t("activity.outcomes_for", { tool: t("activity." + selected) })
					: t("activity.compare")}
			</p>
			{stats ? (
				<TrendChart
					metric={active ?? { total: total ?? 0, points: [] }}
					bucket={stats.bucket}
					height={210}
					color={TOOL_COLORS[selected ?? "search"]}
					comparison={
						active
							? undefined
							: TOOL_KINDS.map((k) => ({
									name: t("activity." + k),
									color: TOOL_COLORS[k],
									metric: stats.metrics[metricKeys[k]],
								}))
					}
				/>
			) : (
				<div className="grid min-h-48 place-items-center text-xs text-muted">
					{t(loading ? "admin.stats_loading" : "admin.stats_unavailable")}
				</div>
			)}
			{active?.outcomes && (
				<ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
					{TOOL_OUTCOMES.filter((k) => k === "success" || active.outcomes?.[k]).map((k) => (
						<li key={k} className="flex items-center gap-1.5">
							<span className="size-2 rounded-full" style={{ background: OUTCOME_COLORS[k] }} />
							{t("admin.stats_" + k)} {format(active.outcomes?.[k])}
						</li>
					))}
				</ul>
			)}
			<table className="mt-3 w-full text-right text-xs tabular-nums">
				<thead className="border-b border-default text-muted">
					<tr>
						{["tool", "calls", "failed", "limited", "logs"].map((v, i) => (
							<th
								scope="col"
								key={v}
								className={"py-2 font-medium " + (i === 0 ? "text-left" : "")}
							>
								{t("activity." + v)}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{TOOL_KINDS.map((k) => {
						const metric = stats?.metrics[metricKeys[k]];
						return (
							<tr key={k} className="border-b border-default last:border-0">
								<th scope="row" className="text-left">
									<button
										type="button"
										aria-pressed={selected === k}
										className="inline-flex min-h-10 items-center gap-1.5 rounded text-left font-medium text-light aria-pressed:text-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
										onClick={() => setSelected(k)}
									>
										<span
											className="size-2 shrink-0 rounded-full"
											style={{ background: TOOL_COLORS[k] }}
										/>
										{t("activity." + k)}
									</button>
								</th>
								<td>{format(metric?.total)}</td>
								<td>{format(metric?.outcomes?.failed)}</td>
								<td>{format(metric?.outcomes?.limited)}</td>
								<td>
									<Link
										className="inline-flex min-h-10 min-w-8 items-center justify-end rounded text-brand focus-visible:outline-2 focus-visible:outline-brand"
										aria-label={t("activity.open_logs", { tool: t("activity." + k) })}
										to={`/admin/${k}-logs${detailQuery ? "?" + detailQuery : ""}`}
									>
										<IconArrowUpRight className="size-4" />
									</Link>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</Card>
	);
}
