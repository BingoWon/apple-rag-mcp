import {
	type DocChangeFlags,
	type DocChangeKind,
	type DocChangeSignificance,
	type DocSweepSource,
	extractFrameworkFromUrl,
	isFrameworkRootUrl,
	isReleaseNotesUrl,
} from "../../shared/doc-updates.js";

export interface DetectedDocChange {
	url: string;
	framework: string;
	title: string;
	symbol_kind: string | null;
	change_kind: DocChangeKind;
	significance: DocChangeSignificance;
	sweep_source: DocSweepSource;
	summary: string;
	change_flags: DocChangeFlags;
	diff_snippet: string | null;
	source_modified_at: Date | null;
}

interface ParsedDocMetadata {
	moduleName: string | null;
	symbolKind: string | null;
	platforms: Map<string, { introducedAt: string; deprecatedAt: string; beta: boolean }>;
	hasDeprecation: boolean;
	isBeta: boolean;
	declarations: string;
	topicCount: number;
}

const MAX_DIFF_LINES = 40;
const MAX_DIFF_CHARS = 3_000;
const MAX_LCS_LINES = 450;

function parseRawJson(raw: unknown): Record<string, unknown> | null {
	if (!raw) return null;
	if (typeof raw === "string") {
		try {
			const parsed = JSON.parse(raw);
			return typeof parsed === "object" && parsed !== null
				? (parsed as Record<string, unknown>)
				: null;
		} catch {
			return null;
		}
	}
	if (typeof raw === "object") return raw as Record<string, unknown>;
	return null;
}

function collectDeclarationTokens(value: unknown, out: string[]): void {
	if (!value) return;
	if (typeof value === "string") {
		out.push(value);
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) collectDeclarationTokens(item, out);
		return;
	}
	if (typeof value === "object") {
		const obj = value as Record<string, unknown>;
		if (typeof obj.text === "string") out.push(obj.text);
		if (Array.isArray(obj.tokens)) collectDeclarationTokens(obj.tokens, out);
		if (Array.isArray(obj.declarations)) collectDeclarationTokens(obj.declarations, out);
	}
}

function extractDocMetadata(raw: unknown): ParsedDocMetadata {
	const empty: ParsedDocMetadata = {
		moduleName: null,
		symbolKind: null,
		platforms: new Map(),
		hasDeprecation: false,
		isBeta: false,
		declarations: "",
		topicCount: 0,
	};
	const doc = parseRawJson(raw);
	if (!doc) return empty;

	const metadata =
		typeof doc.metadata === "object" && doc.metadata !== null
			? (doc.metadata as Record<string, unknown>)
			: {};

	let moduleName: string | null = null;
	if (Array.isArray(metadata.modules) && metadata.modules.length > 0) {
		const first = metadata.modules[0] as Record<string, unknown> | undefined;
		if (typeof first?.name === "string" && first.name.trim()) {
			moduleName = first.name.trim();
		}
	}

	const symbolKind =
		typeof metadata.symbolKind === "string" && metadata.symbolKind.trim()
			? metadata.symbolKind.trim()
			: typeof metadata.roleHeading === "string" && metadata.roleHeading.trim()
				? metadata.roleHeading.trim()
				: null;

	const platforms = new Map<
		string,
		{ introducedAt: string; deprecatedAt: string; beta: boolean }
	>();
	let anyDeprecated = false;
	let anyBeta = false;
	if (Array.isArray(metadata.platforms)) {
		for (const item of metadata.platforms) {
			if (!item || typeof item !== "object") continue;
			const p = item as Record<string, unknown>;
			if (typeof p.name !== "string" || !p.name.trim()) continue;
			const introducedAt = typeof p.introducedAt === "string" ? p.introducedAt.trim() : "";
			const deprecatedAt = typeof p.deprecatedAt === "string" ? p.deprecatedAt.trim() : "";
			const beta = Boolean(p.beta);
			const deprecated = Boolean(p.deprecated) || deprecatedAt.length > 0;
			if (deprecated) anyDeprecated = true;
			if (beta) anyBeta = true;
			platforms.set(p.name.trim(), { introducedAt, deprecatedAt, beta });
		}
	}

	const hasDeprecation =
		anyDeprecated || (Array.isArray(doc.deprecationSummary) && doc.deprecationSummary.length > 0);

	const declParts: string[] = [];
	if (Array.isArray(doc.primaryContentSections)) {
		for (const sec of doc.primaryContentSections) {
			if (!sec || typeof sec !== "object") continue;
			const obj = sec as Record<string, unknown>;
			if (obj.kind === "declarations") {
				collectDeclarationTokens(obj.declarations, declParts);
			}
		}
	}

	let topicCount = 0;
	if (Array.isArray(doc.topicSections)) {
		for (const section of doc.topicSections) {
			if (!section || typeof section !== "object") continue;
			const ids = (section as Record<string, unknown>).identifiers;
			if (Array.isArray(ids)) topicCount += ids.length;
		}
	}

	return {
		moduleName,
		symbolKind,
		platforms,
		hasDeprecation,
		isBeta: anyBeta,
		declarations: declParts.join("").replace(/\s+/g, " ").trim(),
		topicCount,
	};
}

export function normalizeMarkdownLines(text: string): string[] {
	const lines = text
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.trimEnd());
	const compact: string[] = [];
	let prevBlank = true;
	for (const line of lines) {
		const blank = line.trim().length === 0;
		if (blank) {
			if (!prevBlank) compact.push("");
			prevBlank = true;
		} else {
			compact.push(line);
			prevBlank = false;
		}
	}
	if (compact.length > 0 && compact[compact.length - 1] === "") compact.pop();
	return compact;
}

interface LineDiffResult {
	linesAdded: number;
	linesRemoved: number;
	snippet: string | null;
}

export function buildCompactUnifiedDiff(oldContent: string, newContent: string): LineDiffResult {
	const a = normalizeMarkdownLines(oldContent);
	const b = normalizeMarkdownLines(newContent);

	if (a.length === b.length && a.every((line, i) => line === b[i])) {
		return { linesAdded: 0, linesRemoved: 0, snippet: null };
	}

	// Trim common prefix and suffix to keep DP matrix tiny and fast
	let prefix = 0;
	while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
		prefix++;
	}
	let suffix = 0;
	while (
		suffix < a.length - prefix &&
		suffix < b.length - prefix &&
		a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
	) {
		suffix++;
	}

	const midA = a.slice(prefix, a.length - suffix);
	const midB = b.slice(prefix, b.length - suffix);

	type Op = { type: "eq" | "del" | "add"; text: string };
	const ops: Op[] = [];

	if (midA.length <= MAX_LCS_LINES && midB.length <= MAX_LCS_LINES) {
		const m = midA.length;
		const n = midB.length;
		const stride = n + 1;
		const dp = new Uint16Array((m + 1) * stride);
		for (let i = m - 1; i >= 0; i--) {
			const rowOffset = i * stride;
			const nextRowOffset = (i + 1) * stride;
			for (let j = n - 1; j >= 0; j--) {
				if (midA[i] === midB[j]) {
					dp[rowOffset + j] = dp[nextRowOffset + j + 1]! + 1;
				} else {
					const down = dp[nextRowOffset + j]!;
					const right = dp[rowOffset + j + 1]!;
					dp[rowOffset + j] = down >= right ? down : right;
				}
			}
		}
		let i = 0;
		let j = 0;
		while (i < m && j < n) {
			if (midA[i] === midB[j]) {
				ops.push({ type: "eq", text: midA[i]! });
				i++;
				j++;
			} else if (dp[(i + 1) * stride + j]! >= dp[i * stride + j + 1]!) {
				ops.push({ type: "del", text: midA[i]! });
				i++;
			} else {
				ops.push({ type: "add", text: midB[j]! });
				j++;
			}
		}
		while (i < m) ops.push({ type: "del", text: midA[i++]! });
		while (j < n) ops.push({ type: "add", text: midB[j++]! });
	} else {
		// Bounded fallback for very large documents: set-based diff summary
		const setA = new Set(midA);
		const setB = new Set(midB);
		for (const line of midA) {
			if (!setB.has(line)) ops.push({ type: "del", text: line });
		}
		for (const line of midB) {
			if (!setA.has(line)) ops.push({ type: "add", text: line });
		}
	}

	let linesAdded = 0;
	let linesRemoved = 0;
	for (const op of ops) {
		if (op.type === "add") linesAdded++;
		else if (op.type === "del") linesRemoved++;
	}

	if (linesAdded === 0 && linesRemoved === 0) {
		return { linesAdded: 0, linesRemoved: 0, snippet: null };
	}

	const output: string[] = [];
	if (prefix > 0) {
		output.push(`  ${a[prefix - 1]}`);
	}

	let truncated = false;
	let charCount = output.reduce((sum, line) => sum + line.length + 1, 0);

	const pushLine = (line: string) => {
		if (output.length >= MAX_DIFF_LINES || charCount + line.length + 1 > MAX_DIFF_CHARS) {
			truncated = true;
			return false;
		}
		output.push(line);
		charCount += line.length + 1;
		return true;
	};

	for (let idx = 0; idx < ops.length; idx++) {
		const op = ops[idx]!;
		if (op.type === "eq") {
			const nearChange =
				(idx > 0 && ops[idx - 1]!.type !== "eq") ||
				(idx + 1 < ops.length && ops[idx + 1]!.type !== "eq");
			if (!nearChange) continue;
			if (!pushLine(`  ${op.text}`)) break;
		} else {
			const prefixChar = op.type === "add" ? "+ " : "- ";
			if (!pushLine(`${prefixChar}${op.text}`)) break;
		}
	}

	if (!truncated && suffix > 0) {
		pushLine(`  ${a[a.length - suffix]}`);
	}
	if (truncated) {
		output.push("... (diff truncated)");
	}

	return {
		linesAdded,
		linesRemoved,
		snippet: output.join("\n"),
	};
}

export function detectDocumentChange(input: {
	url: string;
	oldTitle: string | null;
	oldContent: string;
	oldRawJson?: unknown;
	newTitle: string | null;
	newContent: string;
	newRawJson?: unknown;
	sweepSource: DocSweepSource;
	sourceModifiedAt?: Date | null;
}): DetectedDocChange | null {
	const isVideo = input.url.startsWith("https://developer.apple.com/videos/play/");
	const oldMeta = extractDocMetadata(input.oldRawJson);
	const newMeta = extractDocMetadata(input.newRawJson);
	const framework = extractFrameworkFromUrl(input.url, newMeta.moduleName ?? oldMeta.moduleName);
	const title = (input.newTitle || input.oldTitle || framework).trim();
	const isRoot = isFrameworkRootUrl(input.url);
	const isReleaseNote = isReleaseNotesUrl(input.url);
	const wasEmpty = input.oldContent.trim().length === 0;

	if (wasEmpty) {
		const previewLines = normalizeMarkdownLines(input.newContent).slice(0, 12);
		const snippet = previewLines.length ? previewLines.map((line) => `+ ${line}`).join("\n") : null;
		const changeKind: DocChangeKind = isVideo ? "video_added" : "added";
		const highKinds = new Set([
			"module",
			"collection",
			"article",
			"protocol",
			"class",
			"struct",
			"enum",
			"Framework",
			"Article",
		]);
		const significance: DocChangeSignificance =
			isVideo ||
			isRoot ||
			isReleaseNote ||
			(newMeta.symbolKind && highKinds.has(newMeta.symbolKind))
				? "high"
				: "medium";
		const summary = isVideo
			? `New WWDC video transcript indexed: ${title}`
			: newMeta.isBeta
				? `New beta ${newMeta.symbolKind ?? "documentation"} added in ${framework}`
				: `New ${newMeta.symbolKind ?? "documentation"} page indexed in ${framework}`;

		return {
			url: input.url,
			framework,
			title,
			symbol_kind: newMeta.symbolKind,
			change_kind: changeKind,
			significance,
			sweep_source: isVideo ? "videos" : input.sweepSource,
			summary,
			change_flags: {
				is_framework_root: isRoot || undefined,
				beta_added: newMeta.isBeta || undefined,
				deprecated_added: newMeta.hasDeprecation || undefined,
				lines_added: previewLines.length || undefined,
			},
			diff_snippet: snippet,
			source_modified_at: input.sourceModifiedAt ?? null,
		};
	}

	const diff = buildCompactUnifiedDiff(input.oldContent, input.newContent);
	const titleChanged = (input.oldTitle ?? "").trim() !== (input.newTitle ?? "").trim();

	const hasOldMeta = Boolean(input.oldRawJson);
	const deprecatedAdded = hasOldMeta && !oldMeta.hasDeprecation && newMeta.hasDeprecation;
	const betaAdded = hasOldMeta && !oldMeta.isBeta && newMeta.isBeta;
	const betaRemoved = hasOldMeta && oldMeta.isBeta && !newMeta.isBeta;
	const declarationChanged =
		hasOldMeta &&
		oldMeta.declarations.length > 0 &&
		newMeta.declarations.length > 0 &&
		oldMeta.declarations !== newMeta.declarations;

	const platformsAdded: string[] = [];
	const platformsChanged: string[] = [];
	if (hasOldMeta && newMeta.platforms.size > 0) {
		for (const [name, p] of newMeta.platforms.entries()) {
			const prev = oldMeta.platforms.get(name);
			if (!prev) {
				platformsAdded.push(p.introducedAt ? `${name} ${p.introducedAt}+` : name);
			} else if (prev.introducedAt !== p.introducedAt || prev.deprecatedAt !== p.deprecatedAt) {
				platformsChanged.push(name);
			}
		}
	}

	const topicDelta = hasOldMeta ? newMeta.topicCount - oldMeta.topicCount : 0;
	const hasStructuralChange =
		deprecatedAdded ||
		betaAdded ||
		betaRemoved ||
		declarationChanged ||
		platformsAdded.length > 0 ||
		platformsChanged.length > 0 ||
		topicDelta !== 0 ||
		titleChanged;

	// Skip pure formatting/whitespace churn when neither normalized text nor structured metadata changed
	if (!hasStructuralChange && diff.linesAdded === 0 && diff.linesRemoved === 0) {
		return null;
	}

	let changeKind: DocChangeKind = "content_revised";
	let significance: DocChangeSignificance = "low";
	const summaryParts: string[] = [];

	if (deprecatedAdded) {
		changeKind = "deprecated";
		significance = "high";
		summaryParts.push(`Marked deprecated in ${framework}`);
	} else if (betaAdded || betaRemoved) {
		changeKind = "beta_changed";
		significance = betaRemoved || isRoot ? "high" : "medium";
		summaryParts.push(
			betaRemoved ? `Graduated from beta in ${framework}` : `Marked beta in ${framework}`,
		);
	} else if (declarationChanged || platformsAdded.length > 0 || platformsChanged.length > 0) {
		changeKind = "signature_changed";
		significance = declarationChanged || platformsAdded.length > 0 || isRoot ? "high" : "medium";
		if (declarationChanged) summaryParts.push("API declaration updated");
		if (platformsAdded.length > 0) summaryParts.push(`Added ${platformsAdded.join(", ")}`);
		if (platformsChanged.length > 0)
			summaryParts.push(`Availability updated (${platformsChanged.join(", ")})`);
	} else {
		changeKind = "content_revised";
		const churn = diff.linesAdded + diff.linesRemoved;
		if (isRoot || isReleaseNote || churn >= 25 || Math.abs(topicDelta) >= 3) {
			significance = "high";
		} else if (churn >= 6 || titleChanged || topicDelta !== 0) {
			significance = "medium";
		} else {
			significance = "low";
		}
		if (topicDelta > 0) summaryParts.push(`Added ${topicDelta} topic entries`);
		else if (topicDelta < 0) summaryParts.push(`Removed ${Math.abs(topicDelta)} topic entries`);
		else if (titleChanged) summaryParts.push(`Renamed from "${input.oldTitle ?? ""}"`);
		else summaryParts.push(`Documentation revised in ${framework}`);
	}

	if (diff.linesAdded > 0 || diff.linesRemoved > 0) {
		summaryParts.push(`+${diff.linesAdded} / -${diff.linesRemoved} lines`);
	}

	const flags: DocChangeFlags = {
		is_framework_root: isRoot || undefined,
		deprecated_added: deprecatedAdded || undefined,
		beta_added: betaAdded || undefined,
		beta_removed: betaRemoved || undefined,
		declaration_changed: declarationChanged || undefined,
		platforms_added: platformsAdded.length ? platformsAdded : undefined,
		platforms_changed: platformsChanged.length ? platformsChanged : undefined,
		topics_added: topicDelta > 0 ? topicDelta : undefined,
		topics_removed: topicDelta < 0 ? Math.abs(topicDelta) : undefined,
		lines_added: diff.linesAdded || undefined,
		lines_removed: diff.linesRemoved || undefined,
	};

	return {
		url: input.url,
		framework,
		title,
		symbol_kind: newMeta.symbolKind ?? oldMeta.symbolKind,
		change_kind: changeKind,
		significance,
		sweep_source: input.sweepSource,
		summary: summaryParts.join(" · "),
		change_flags: flags,
		diff_snippet: diff.snippet,
		source_modified_at: input.sourceModifiedAt ?? null,
	};
}

export function createRemovedDocChange(input: {
	url: string;
	title: string | null;
	rawJson?: unknown;
	sweepSource: DocSweepSource;
}): DetectedDocChange {
	const meta = extractDocMetadata(input.rawJson);
	const framework = extractFrameworkFromUrl(input.url, meta.moduleName);
	const title = (input.title || framework).trim();
	return {
		url: input.url,
		framework,
		title,
		symbol_kind: meta.symbolKind,
		change_kind: "removed",
		significance: "high",
		sweep_source: input.sweepSource,
		summary: `Removed from Apple Developer documentation (HTTP 404/410)`,
		change_flags: {
			is_framework_root: isFrameworkRootUrl(input.url) || undefined,
		},
		diff_snippet: null,
		source_modified_at: null,
	};
}
