import {
	IconArrowUpRight,
	IconChevronDown,
	IconChevronUp,
	IconFileDiff,
} from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { parseUTCDate } from "../../../shared/datetime";
import type { DocChangeEventItem, DocChangeKind } from "../../../shared/doc-updates";

const KIND_DOT: Record<DocChangeKind, string> = {
	added: "bg-success",
	video_added: "bg-brand-strong dark:bg-brand",
	deprecated: "bg-destructive",
	removed: "bg-destructive",
	beta_changed: "bg-warning",
	signature_changed: "bg-brand-strong dark:bg-brand",
	content_revised: "bg-subtle",
};

const KIND_LABEL_TEXT: Record<DocChangeKind, string> = {
	added: "text-emerald-700 dark:text-success",
	video_added: "text-brand-strong dark:text-brand",
	deprecated: "text-destructive",
	removed: "text-destructive",
	beta_changed: "text-amber-700 dark:text-warning",
	signature_changed: "text-brand-strong dark:text-brand",
	content_revised: "text-muted",
};

interface ChangeEventCardProps {
	event: DocChangeEventItem;
	onFilterFramework: (framework: string) => void;
}

export function ChangeEventCard({ event, onFilterFramework }: ChangeEventCardProps) {
	const { t, i18n } = useTranslation();
	const [expanded, setExpanded] = useState(false);

	const detectedDate = parseUTCDate(event.detected_at);
	const formattedDetected = detectedDate
		? new Intl.DateTimeFormat(i18n.resolvedLanguage, {
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				hourCycle: "h23",
			}).format(detectedDate)
		: "—";

	const sourceDate = event.source_modified_at ? parseUTCDate(event.source_modified_at) : null;
	const formattedSource = sourceDate
		? new Intl.DateTimeFormat(i18n.resolvedLanguage, {
				month: "short",
				day: "numeric",
			}).format(sourceDate)
		: null;

	return (
		<article className="px-5 py-4 transition-colors duration-150 hover:bg-surface/50 sm:px-6">
			{/* Metadata row: flat inline telemetry, zero competing badge boxes */}
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
					<span className="inline-flex items-center gap-1.5 font-medium">
						<span
							className={`h-1.5 w-1.5 shrink-0 rounded-full ${KIND_DOT[event.change_kind]}`}
							aria-hidden="true"
						/>
						<span className={KIND_LABEL_TEXT[event.change_kind]}>
							{t(`updates.kind_${event.change_kind}`)}
						</span>
					</span>
					<span className="text-border-strong" aria-hidden="true">
						·
					</span>
					<button
						type="button"
						onClick={() => onFilterFramework(event.framework)}
						className="font-mono font-medium text-foreground transition-colors hover:text-brand-strong dark:hover:text-brand"
					>
						{event.framework}
					</button>
					{event.symbol_kind && (
						<>
							<span className="text-border-strong" aria-hidden="true">
								·
							</span>
							<span className="font-mono text-subtle">{event.symbol_kind}</span>
						</>
					)}
					<span className="text-border-strong" aria-hidden="true">
						·
					</span>
					<span className="text-subtle">{t(`updates.source_${event.sweep_source}`)}</span>
				</div>

				<div className="flex items-center gap-2 font-mono text-xs tabular-nums text-subtle">
					{formattedSource && (
						<span title={t("updates.source_modified_hint")}>Apple {formattedSource}</span>
					)}
					{formattedSource && (
						<span className="text-border-strong" aria-hidden="true">
							·
						</span>
					)}
					<time dateTime={event.detected_at}>{formattedDetected}</time>
				</div>
			</div>

			{/* Primary symbol/title + optional diff toggle */}
			<div className="mt-2 flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<a
						href={event.url}
						target="_blank"
						rel="noopener noreferrer"
						className="group inline-flex items-center gap-1 text-[15px] font-medium leading-snug text-foreground transition-colors hover:text-brand-strong dark:hover:text-brand"
					>
						<span className="break-words">{event.title}</span>
						<IconArrowUpRight
							className="h-3.5 w-3.5 shrink-0 text-subtle transition-colors group-hover:text-brand-strong dark:group-hover:text-brand"
							aria-hidden="true"
						/>
					</a>
					<p className="mt-1 text-xs leading-relaxed text-muted sm:text-[13px]">{event.summary}</p>
				</div>

				{event.diff_snippet && (
					<button
						type="button"
						onClick={() => setExpanded((prev) => !prev)}
						aria-expanded={expanded}
						className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium leading-none text-foreground transition-colors duration-150 hover:border-border-strong hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
					>
						<IconFileDiff className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
						<span>{t(expanded ? "updates.hide_diff" : "updates.view_diff")}</span>
						{expanded ? (
							<IconChevronUp className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
						) : (
							<IconChevronDown className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
						)}
					</button>
				)}
			</div>

			{/* Structured diff drawer */}
			{expanded && event.diff_snippet && (
				<div className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface py-2 font-mono text-xs leading-5">
					{event.diff_snippet
						.split("\n")
						.filter((line) => line.trim() !== "+" && line.trim() !== "-")
						.map((line, idx) => {
							const isAdd = line.startsWith("+ ");
							const isDel = line.startsWith("- ");
							const lineClass = isAdd
								? "border-l-2 border-success bg-success/10 text-emerald-700 dark:text-success"
								: isDel
									? "border-l-2 border-destructive bg-destructive/10 text-destructive"
									: "border-l-2 border-transparent text-subtle";
							return (
								<div key={idx} className={`whitespace-pre px-3 py-0.5 ${lineClass}`}>
									{line || " "}
								</div>
							);
						})}
				</div>
			)}
		</article>
	);
}
