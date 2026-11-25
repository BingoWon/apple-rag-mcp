import {
	IconChevronDown,
	IconChevronUp,
	IconExternalLink,
	IconFileDiff,
} from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { parseUTCDate } from "../../../shared/datetime";
import type { DocChangeEventItem, DocChangeKind } from "../../../shared/doc-updates";

const KIND_BADGE_CLASSES: Record<DocChangeKind, string> = {
	added: "border-success/30 bg-success/10 text-success",
	video_added: "border-brand/30 bg-brand/15 text-brand",
	deprecated: "border-destructive/30 bg-destructive/10 text-destructive",
	removed: "border-destructive/30 bg-destructive/10 text-destructive",
	beta_changed: "border-warning/30 bg-warning/10 text-warning",
	signature_changed: "border-brand/30 bg-brand/10 text-brand",
	content_revised: "border-border bg-surface-subtle text-foreground",
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
		<article className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-strong">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={() => onFilterFramework(event.framework)}
						className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-semibold text-foreground hover:border-brand/50 hover:text-brand"
					>
						{event.framework}
					</button>
					<span
						className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${KIND_BADGE_CLASSES[event.change_kind]}`}
					>
						{t(`updates.kind_${event.change_kind}`)}
					</span>
					{event.symbol_kind && (
						<span className="rounded-md bg-surface-subtle px-1.5 py-0.5 font-mono text-[11px] text-subtle">
							{event.symbol_kind}
						</span>
					)}
					<span className="text-[11px] text-subtle">
						{t(`updates.source_${event.sweep_source}`)}
					</span>
				</div>

				<div className="flex items-center gap-2 text-xs text-subtle">
					{formattedSource && (
						<span title={t("updates.source_modified_hint")}>Apple {formattedSource}</span>
					)}
					<time dateTime={event.detected_at}>{formattedDetected}</time>
				</div>
			</div>

			<div className="mt-2.5 flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<a
						href={event.url}
						target="_blank"
						rel="noopener noreferrer"
						className="group inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-brand sm:text-base"
					>
						<span className="break-words">{event.title}</span>
						<IconExternalLink
							className="h-3.5 w-3.5 shrink-0 text-subtle group-hover:text-brand"
							aria-hidden="true"
						/>
					</a>
					<p className="mt-1 text-xs leading-relaxed text-subtle sm:text-sm">{event.summary}</p>
				</div>

				{event.diff_snippet && (
					<button
						type="button"
						onClick={() => setExpanded((prev) => !prev)}
						aria-expanded={expanded}
						className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-subtle"
					>
						<IconFileDiff className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
						<span>{t(expanded ? "updates.hide_diff" : "updates.view_diff")}</span>
						{expanded ? (
							<IconChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
						) : (
							<IconChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
						)}
					</button>
				)}
			</div>

			{expanded && event.diff_snippet && (
				<div className="mt-3 overflow-x-auto rounded-lg border border-border bg-surface p-3 font-mono text-xs leading-relaxed">
					{event.diff_snippet.split("\n").map((line, idx) => {
						const isAdd = line.startsWith("+ ");
						const isDel = line.startsWith("- ");
						const lineClass = isAdd
							? "bg-success/10 text-success"
							: isDel
								? "bg-destructive/10 text-destructive"
								: "text-subtle";
						return (
							<div key={idx} className={`whitespace-pre px-2 py-0.5 ${lineClass}`}>
								{line || " "}
							</div>
						);
					})}
				</div>
			)}
		</article>
	);
}
