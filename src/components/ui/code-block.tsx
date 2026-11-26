import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { copyText } from "@/utils/clipboard";

type TokenKind = "plain" | "key" | "string" | "number" | "keyword" | "comment" | "flag" | "punct";

interface CodeToken {
	kind: TokenKind;
	text: string;
}

const TOKEN_CLASSES: Record<TokenKind, string> = {
	plain: "text-slate-100",
	key: "text-[#e06c75]",
	string: "text-[#98c379]",
	number: "text-[#d19a66]",
	keyword: "text-[#61afef]",
	comment: "text-slate-500 italic",
	flag: "text-[#c678dd]",
	punct: "text-slate-400",
};

function tokenizeJsonLine(line: string): CodeToken[] {
	const tokens: CodeToken[] = [];
	const pattern =
		/("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],:]/g;
	let last = 0;
	for (const match of line.matchAll(pattern)) {
		const index = match.index ?? 0;
		if (index > last) tokens.push({ kind: "plain", text: line.slice(last, index) });
		const [full, quoted, colon] = match;
		if (quoted) {
			if (colon) {
				tokens.push({ kind: "key", text: quoted });
				tokens.push({ kind: "punct", text: colon });
			} else {
				tokens.push({ kind: "string", text: quoted });
			}
		} else if (/^(?:true|false|null)$/.test(full)) {
			tokens.push({ kind: "keyword", text: full });
		} else if (/^[{}[\],:]$/.test(full)) {
			tokens.push({ kind: "punct", text: full });
		} else {
			tokens.push({ kind: "number", text: full });
		}
		last = index + full.length;
	}
	if (last < line.length) tokens.push({ kind: "plain", text: line.slice(last) });
	return tokens;
}

function tokenizeTomlLine(line: string): CodeToken[] {
	const trimmed = line.trimStart();
	if (trimmed.startsWith("#")) return [{ kind: "comment", text: line }];
	if (/^\[.+\]\s*$/.test(trimmed)) return [{ kind: "keyword", text: line }];

	const eq = line.indexOf("=");
	if (eq > 0) {
		const lhs = line.slice(0, eq);
		const rhs = line.slice(eq + 1);
		return [{ kind: "key", text: lhs }, { kind: "punct", text: "=" }, ...tokenizeJsonLine(rhs)];
	}
	return [{ kind: "plain", text: line }];
}

function tokenizeBashLine(line: string): CodeToken[] {
	const trimmed = line.trimStart();
	if (trimmed.startsWith("#")) return [{ kind: "comment", text: line }];

	const tokens: CodeToken[] = [];
	const pattern = /("(?:\\.|[^"\\])*"|'[^']*')|((?:^|\s)--?[a-zA-Z0-9-]+)|\bhttps?:\/\/\S+|\\\s*$/g;
	let last = 0;
	let firstWordHandled = false;

	const pushPlain = (segment: string) => {
		if (!segment) return;
		if (!firstWordHandled) {
			const match = segment.match(/^(\s*)([^\s]+)(.*)$/);
			if (match) {
				firstWordHandled = true;
				if (match[1]) tokens.push({ kind: "plain", text: match[1] });
				tokens.push({ kind: "keyword", text: match[2] });
				if (match[3]) tokens.push({ kind: "plain", text: match[3] });
				return;
			}
		}
		tokens.push({ kind: "plain", text: segment });
	};

	for (const match of line.matchAll(pattern)) {
		const index = match.index ?? 0;
		if (index > last) pushPlain(line.slice(last, index));
		const [full, quoted, flag] = match;
		if (quoted) {
			tokens.push({ kind: "string", text: quoted });
			firstWordHandled = true;
		} else if (flag) {
			const ws = flag.match(/^\s+/)?.[0] ?? "";
			if (ws) tokens.push({ kind: "plain", text: ws });
			tokens.push({ kind: "flag", text: flag.slice(ws.length) });
			firstWordHandled = true;
		} else if (full.startsWith("http")) {
			tokens.push({ kind: "string", text: full });
			firstWordHandled = true;
		} else {
			tokens.push({ kind: "punct", text: full });
		}
		last = index + full.length;
	}
	if (last < line.length) pushPlain(line.slice(last));
	return tokens;
}

export function tokenizeCodeLine(line: string, language: string): CodeToken[] {
	switch (language.toLowerCase()) {
		case "json":
			return tokenizeJsonLine(line);
		case "toml":
			return tokenizeTomlLine(line);
		case "bash":
		case "sh":
		case "shell":
			return tokenizeBashLine(line);
		default:
			return [{ kind: "plain", text: line }];
	}
}

type CodeBlockProps = {
	language: string;
	filename: string;
	highlightLines?: number[];
} & (
	| {
			code: string;
			tabs?: never;
	  }
	| {
			code?: never;
			tabs: Array<{
				name: string;
				code: string;
				language?: string;
				highlightLines?: number[];
			}>;
	  }
);

export const CodeBlock = ({
	language,
	filename,
	code,
	highlightLines = [],
	tabs = [],
}: CodeBlockProps) => {
	const { t } = useTranslation();
	const [copied, setCopied] = useState(false);
	const [activeTab, setActiveTab] = useState(0);

	const tabsExist = tabs.length > 0;
	const activeCode = (tabsExist ? tabs[activeTab]?.code : code) ?? "";
	const activeLanguage = (tabsExist ? tabs[activeTab]?.language || language : language) ?? "";
	const activeHighlightLines = tabsExist ? tabs[activeTab]?.highlightLines || [] : highlightLines;
	const lines = activeCode.split("\n");

	const copyToClipboard = async () => {
		if (!activeCode) return;
		await copyText(activeCode);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="relative w-full rounded-lg bg-slate-900 p-4 font-mono text-sm text-slate-100">
			<div className="flex flex-col gap-2">
				{tabsExist && (
					<div className="flex overflow-x-auto">
						{tabs.map((tab, index) => (
							<button
								type="button"
								key={tab.name}
								onClick={() => setActiveTab(index)}
								className={`px-3 py-2 text-xs transition-colors font-sans ${
									activeTab === index ? "text-white" : "text-zinc-400 hover:text-zinc-200"
								}`}
							>
								{tab.name}
							</button>
						))}
					</div>
				)}
				{!tabsExist && filename && (
					<div className="flex items-center justify-between py-2">
						<div className="text-xs text-zinc-400">{filename}</div>
						<button
							type="button"
							onClick={copyToClipboard}
							aria-label={t(copied ? "common.copied" : "common.copy")}
							className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors font-sans"
						>
							{copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
						</button>
					</div>
				)}
			</div>
			<pre className="m-0 overflow-x-auto p-0 text-sm leading-6">
				<code className="block min-w-full whitespace-pre">
					{lines.map((line, lineIndex) => {
						const lineNumber = lineIndex + 1;
						const highlighted = activeHighlightLines.includes(lineNumber);
						const tokens = tokenizeCodeLine(line, activeLanguage);
						let charOffset = 0;
						return (
							<span key={lineNumber} className={`flex w-full ${highlighted ? "bg-white/10" : ""}`}>
								<span
									aria-hidden="true"
									className="mr-4 inline-block w-6 shrink-0 select-none text-right text-xs leading-6 text-slate-500 tabular-nums"
								>
									{lineNumber}
								</span>
								<span className="flex-1 whitespace-pre">
									{tokens.length === 0
										? " "
										: tokens.map((token) => {
												const key = `${lineNumber}-${charOffset}`;
												charOffset += token.text.length;
												return (
													<span key={key} className={TOKEN_CLASSES[token.kind]}>
														{token.text}
													</span>
												);
											})}
								</span>
							</span>
						);
					})}
				</code>
			</pre>
		</div>
	);
};
