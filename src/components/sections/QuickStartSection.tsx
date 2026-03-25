import { IconBolt, IconCheck, IconCopy, IconRocket, IconSparkles } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_CLIENTS } from "@/constants/clients";

const CONFIG_CODE = JSON.stringify(
	{ mcpServers: { "apple-rag-mcp": { url: "https://mcp.apple-rag.com" } } },
	null,
	2,
);

export function QuickStartSection() {
	const { t } = useTranslation();
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		await navigator.clipboard.writeText(CONFIG_CODE);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="relative py-24 sm:py-32">
			<div className="mx-auto max-w-7xl px-6 lg:px-8">
				<div className="mx-auto max-w-4xl lg:text-center mb-12">
					<h2 className="text-base font-semibold leading-7 text-brand">
						{t("quickstart.eyebrow")}
					</h2>
					<p className="mt-2 text-3xl font-bold tracking-tight text-light sm:text-4xl">
						{t("quickstart.title")}
					</p>
					<p className="mt-6 text-lg leading-8 text-muted">{t("quickstart.subtitle")}</p>
				</div>

				<div className="mx-auto max-w-2xl">
					<div className="rounded-xl overflow-hidden shadow-2xl border border-black/10 dark:border-white/10 bg-[#1e1e1e]">
						{/* Title Bar */}
						<div className="flex items-center justify-between px-4 py-3 bg-[#2d2d2d] border-b border-white/5">
							<div className="flex items-center gap-2">
								<span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
								<span className="w-3 h-3 rounded-full bg-[#febc2e]" />
								<span className="w-3 h-3 rounded-full bg-[#28c840]" />
							</div>
							<span className="text-xs text-[#8b8b8b] font-medium select-none">
								mcp-config.json
							</span>
							<button
								type="button"
								onClick={handleCopy}
								className="flex items-center gap-1.5 text-xs text-[#8b8b8b] hover:text-white transition-colors duration-200 px-2 py-1 rounded-md hover:bg-white/10"
							>
								{copied ? (
									<>
										<IconCheck className="w-3.5 h-3.5 text-[#28c840]" />
										<span className="text-[#28c840]">{t("common.copied")}</span>
									</>
								) : (
									<>
										<IconCopy className="w-3.5 h-3.5" />
										<span>{t("common.copy")}</span>
									</>
								)}
							</button>
						</div>

						{/* Code Area */}
						<div className="p-5 overflow-x-auto">
							<JsonHighlight code={CONFIG_CODE} />
						</div>
					</div>
				</div>

				{/* Pro Upgrade Banner */}
				<div className="mx-auto max-w-2xl mt-6">
					<a
						href="#pricing"
						className="group block rounded-xl border border-brand/20 bg-brand/5 hover:bg-brand/10 transition-colors duration-200 px-5 py-4"
					>
						<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 justify-between">
							<div className="flex flex-wrap items-center gap-2 text-sm">
								<span className="inline-flex items-center gap-1 text-brand font-semibold">
									<IconRocket className="w-4 h-4" />
									Pro
								</span>
								<span className="inline-flex items-center gap-1 text-muted">
									<IconBolt className="w-3.5 h-3.5 text-brand/70" />
									{t("quickstart.pro_queries")}
								</span>
								<span className="text-muted/40">·</span>
								<span className="inline-flex items-center gap-1 text-muted">
									<IconSparkles className="w-3.5 h-3.5 text-brand/70" />
									{t("quickstart.pro_speed")}
								</span>
							</div>
							<span className="text-sm font-medium text-brand group-hover:underline whitespace-nowrap">
								{t("quickstart.pro_cta")} →
							</span>
						</div>
					</a>
				</div>

				<div className="mt-10 text-center">
					<h3 className="text-sm font-semibold text-light mb-2">
						{t("quickstart.supported_clients")}
					</h3>
					<p className="text-sm text-muted leading-relaxed">
						{SUPPORTED_CLIENTS.join(" · ")} · {t("quickstart.and_more")}
					</p>
				</div>
			</div>
		</div>
	);
}

function JsonHighlight({ code }: { code: string }) {
	return (
		<pre className="text-sm leading-relaxed font-mono text-[#d4d4d4]">
			<code>
				{code.split("\n").map((line, i) => (
					<span key={i} className="block">
						{tokenizeLine(line)}
					</span>
				))}
			</code>
		</pre>
	);
}

function tokenizeLine(line: string): React.ReactNode[] {
	const result: React.ReactNode[] = [];
	const re = /("(?:[^"\\]|\\.)*")(\s*:)?/g;
	let last = 0;
	let match = re.exec(line);
	while (match !== null) {
		if (match.index > last) result.push(line.slice(last, match.index));
		result.push(
			<span key={match.index} className={match[2] ? "text-[#9cdcfe]" : "text-[#ce9178]"}>
				{match[1]}
			</span>,
		);
		if (match[2]) result.push(match[2]);
		last = match.index + match[0].length;
		match = re.exec(line);
	}
	if (last < line.length) result.push(line.slice(last));
	return result;
}
