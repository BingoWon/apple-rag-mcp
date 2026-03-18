import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_CLIENTS } from "@/constants/pricing";

const CONFIG_CODE = `{
  "mcpServers": {
    "apple-rag-mcp": {
      "url": "https://mcp.apple-rag.com"
    }
  }
}`;

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
					{/* macOS Terminal Window */}
					<div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-[#1e1e1e]">
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
							<pre className="text-sm leading-relaxed font-mono">
								<code>
									<SyntaxLine>{"{"}</SyntaxLine>
									<SyntaxLine indent={1}>
										<JsonKey>"mcpServers"</JsonKey>
										<Punctuation>: {"{"}</Punctuation>
									</SyntaxLine>
									<SyntaxLine indent={2}>
										<JsonKey>"apple-rag-mcp"</JsonKey>
										<Punctuation>: {"{"}</Punctuation>
									</SyntaxLine>
									<SyntaxLine indent={3}>
										<JsonKey>"url"</JsonKey>
										<Punctuation>: </Punctuation>
										<JsonValue>"https://mcp.apple-rag.com"</JsonValue>
									</SyntaxLine>
									<SyntaxLine indent={2}>
										<Punctuation>{"}"}</Punctuation>
									</SyntaxLine>
									<SyntaxLine indent={1}>
										<Punctuation>{"}"}</Punctuation>
									</SyntaxLine>
									<SyntaxLine>{"}"}</SyntaxLine>
								</code>
							</pre>
						</div>
					</div>

					<div className="mt-8 text-center">
						<h3 className="text-sm font-semibold text-light mb-2">
							{t("quickstart.supported_clients")}
						</h3>
						<p className="text-sm text-muted leading-relaxed">
							{SUPPORTED_CLIENTS.filter((c) => c !== "and more...").join(" · ")}{" "}
							· {t("quickstart.and_more")}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}

function SyntaxLine({ children, indent = 0 }: { children: React.ReactNode; indent?: number }) {
	return (
		<span className="block" style={{ paddingLeft: `${indent * 1.5}rem` }}>
			{children}
		</span>
	);
}

function JsonKey({ children }: { children: React.ReactNode }) {
	return <span className="text-[#9cdcfe]">{children}</span>;
}

function JsonValue({ children }: { children: React.ReactNode }) {
	return <span className="text-[#ce9178]">{children}</span>;
}

function Punctuation({ children }: { children: React.ReactNode }) {
	return <span className="text-[#d4d4d4]">{children}</span>;
}
