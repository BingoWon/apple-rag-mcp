import postgres from "postgres";
import { z } from "zod";
import type {
	DigestLocaleContent,
	DigestPeriodType,
	DigestStats,
	DocChangeDigest,
	DocChangeEventItem,
} from "../../shared/doc-updates.js";
import { SITE_ORIGIN } from "../../shared/site.js";
import { submitIndexNow } from "../indexnow.js";
import { frameworkSlug } from "../seo-pages.js";
import { logger } from "../shared/logger.js";
import type { Env } from "../shared/types.js";

const DAILY_FREE_NEURON_LIMIT = 8_000;
const ZENMUX_CHAT_ENDPOINT = "https://zenmux.ai/api/v1/chat/completions";
const ZENMUX_FALLBACK_MODEL = "deepseek/deepseek-chat";

interface WorkersAIModelSpec {
	readonly id: string;
	readonly inputNeuronsPerM: number;
	readonly outputNeuronsPerM: number;
	readonly reasoningEffort?: "low" | "medium" | "none";
}

export const WORKERS_AI_DIGEST_MODELS: readonly WorkersAIModelSpec[] = [
	{
		id: "@cf/openai/gpt-oss-120b",
		inputNeuronsPerM: 31_818,
		outputNeuronsPerM: 68_182,
		reasoningEffort: "low",
	},
	{
		id: "@cf/deepseek-ai/deepseek-v4.1-flash-1017",
		inputNeuronsPerM: 27_273,
		outputNeuronsPerM: 109_091,
		reasoningEffort: "low",
	},
	{
		id: "@cf/google/gemma-4-26b-a4b-it",
		inputNeuronsPerM: 9_091,
		outputNeuronsPerM: 27_273,
	},
] as const;

const localeContentSchema = z.object({
	headline: z.string().min(4).max(180),
	overview: z.string().min(10).max(900),
	strategy_notes: z.array(z.string().min(4).max(320)).max(5).default([]),
	highlights: z
		.array(
			z.object({
				framework: z.string().min(1).max(80),
				title: z.string().min(2).max(140),
				summary: z.string().min(6).max(360),
				urls: z.array(z.string().url()).max(5).default([]),
			}),
		)
		.max(6)
		.default([]),
	alerts: z
		.array(
			z.object({
				kind: z.enum(["deprecated", "beta", "removed", "breaking"]),
				framework: z.string().min(1).max(80),
				title: z.string().min(2).max(140),
				note: z.string().min(4).max(280),
				url: z.string().url(),
			}),
		)
		.max(8)
		.default([]),
});

const dualDigestSchema = z.object({
	en: localeContentSchema,
	zh: localeContentSchema,
});

export function estimateNeurons(
	model: Pick<WorkersAIModelSpec, "inputNeuronsPerM" | "outputNeuronsPerM">,
	inputTokens: number,
	outputTokens: number,
): number {
	return Math.ceil(
		(Math.max(0, inputTokens) * model.inputNeuronsPerM) / 1_000_000 +
			(Math.max(0, outputTokens) * model.outputNeuronsPerM) / 1_000_000,
	);
}

export function formatUtcDayKey(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function formatIsoWeekKey(date: Date): string {
	const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
	return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function extractJsonPayload(raw: unknown): unknown {
	if (raw && typeof raw === "object") {
		const obj = raw as Record<string, unknown>;
		if ("en" in obj && "zh" in obj) return obj;
		if (typeof obj.response === "string") return extractJsonPayload(obj.response);
		if (obj.response && typeof obj.response === "object") return obj.response;
		const choices = obj.choices;
		if (Array.isArray(choices) && choices.length > 0) {
			const first = choices[0] as Record<string, unknown>;
			const message = first.message as Record<string, unknown> | undefined;
			if (typeof message?.content === "string") return extractJsonPayload(message.content);
		}
	}
	if (typeof raw !== "string") return null;
	const trimmed = raw.trim();
	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const candidate = fenced ? fenced[1]!.trim() : trimmed;
	const start = candidate.indexOf("{");
	const end = candidate.lastIndexOf("}");
	if (start === -1 || end <= start) return null;
	try {
		return JSON.parse(candidate.slice(start, end + 1));
	} catch {
		return null;
	}
}

export function sanitizeDigestUrls(
	payload: z.infer<typeof dualDigestSchema>,
	allowedUrls: ReadonlySet<string>,
): { en: DigestLocaleContent; zh: DigestLocaleContent } {
	const filterLocale = (content: DigestLocaleContent): DigestLocaleContent => ({
		...content,
		highlights: content.highlights.map((h) => ({
			...h,
			urls: h.urls.filter((u) => allowedUrls.has(u)),
		})),
		alerts: content.alerts.filter((a) => allowedUrls.has(a.url)),
	});
	return {
		en: filterLocale(payload.en),
		zh: filterLocale(payload.zh),
	};
}

export function buildDeterministicDigest(
	periodType: DigestPeriodType,
	periodKey: string,
	stats: DigestStats,
	events: readonly DocChangeEventItem[],
): { en: DigestLocaleContent; zh: DigestLocaleContent } {
	const topNames = stats.top_frameworks.slice(0, 3).map((f) => f.framework);
	const labelEn = periodType === "weekly" ? `Week ${periodKey}` : periodKey;
	const labelZh = periodType === "weekly" ? `${periodKey} 周报` : `${periodKey} 日报`;

	if (stats.total_events === 0) {
		return {
			en: {
				headline: `Quiet Apple documentation window (${labelEn})`,
				overview:
					"The collector completed scheduled radar and corpus checks during this window without detecting substantial changes in Apple Developer documentation.",
				strategy_notes: [
					"All monitored framework hubs and release note feeds remained stable.",
					"Incremental verification continues every 5 minutes.",
				],
				highlights: [],
				alerts: [],
			},
			zh: {
				headline: `Apple 官方文档平稳期（${labelZh}）`,
				overview:
					"本周期内采集雷达与全量巡检持续运行，Apple 官方开发者文档整体保持平稳，未捕获到显著的内容或接口变更。",
				strategy_notes: [
					"核心框架入口与发布说明保持稳定，未出现批量新增或废弃。",
					"系统每 5 分钟持续执行高频雷达与增量巡检。",
				],
				highlights: [],
				alerts: [],
			},
		};
	}

	const grouped = new Map<string, DocChangeEventItem[]>();
	for (const event of events) {
		const list = grouped.get(event.framework) ?? [];
		list.push(event);
		grouped.set(event.framework, list);
	}

	const highlightsEn = stats.top_frameworks.slice(0, 4).map(({ framework, count }) => {
		const sample = (grouped.get(framework) ?? []).slice(0, 3);
		const titles = sample.map((e) => e.title).join(", ");
		return {
			framework,
			title: `${framework}: ${count} documentation updates`,
			summary: titles
				? `Notable updates include ${titles}.`
				: `${count} pages updated in ${framework}.`,
			urls: sample.map((e) => e.url),
		};
	});

	const highlightsZh = stats.top_frameworks.slice(0, 4).map(({ framework, count }) => {
		const sample = (grouped.get(framework) ?? []).slice(0, 3);
		const titles = sample.map((e) => e.title).join("、");
		return {
			framework,
			title: `${framework} 共捕获 ${count} 处文档变动`,
			summary: titles
				? `重点涉及 ${titles} 等页面更新。`
				: `${framework} 模块本周期有 ${count} 项页面更新。`,
			urls: sample.map((e) => e.url),
		};
	});

	const alertEvents = events
		.filter(
			(e) =>
				e.change_kind === "deprecated" ||
				e.change_kind === "removed" ||
				e.change_kind === "beta_changed",
		)
		.slice(0, 6);

	const alertsEn = alertEvents.map((e) => ({
		kind: (e.change_kind === "deprecated"
			? "deprecated"
			: e.change_kind === "removed"
				? "removed"
				: "beta") as "deprecated" | "beta" | "removed",
		framework: e.framework,
		title: e.title,
		note: e.summary,
		url: e.url,
	}));

	const alertsZh = alertEvents.map((e) => ({
		kind: (e.change_kind === "deprecated"
			? "deprecated"
			: e.change_kind === "removed"
				? "removed"
				: "beta") as "deprecated" | "beta" | "removed",
		framework: e.framework,
		title: e.title,
		note:
			e.change_kind === "deprecated"
				? `${e.framework} 中新增废弃标记，建议及时核对替代接口。`
				: e.change_kind === "removed"
					? `页面已从 Apple 官方文档下线（HTTP 404/410）。`
					: `${e.framework} 中的 Beta 标记发生变化，建议留意兼容版本。`,
		url: e.url,
	}));

	const addedCount = (stats.by_kind.added ?? 0) + (stats.by_kind.video_added ?? 0);
	const depCount = stats.by_kind.deprecated ?? 0;

	return {
		en: {
			headline: topNames.length
				? `${topNames.join(", ")} lead ${stats.total_events} Apple doc updates (${labelEn})`
				: `${stats.total_events} Apple documentation updates captured (${labelEn})`,
			overview: `Captured ${stats.total_events} documentation changes across ${stats.frameworks_touched} Apple frameworks, including ${stats.high_significance} high-significance updates${addedCount ? ` and ${addedCount} newly indexed pages` : ""}.`,
			strategy_notes: [
				topNames.length
					? `Most active modules: ${topNames.join(", ")}.`
					: "Activity distributed across Apple Developer documentation.",
				depCount > 0
					? `${depCount} deprecation notices detected; review affected APIs below.`
					: "No new API deprecations flagged in this window.",
			],
			highlights: highlightsEn,
			alerts: alertsEn,
		},
		zh: {
			headline: topNames.length
				? `${topNames.join("、")} 领衔本周期 ${stats.total_events} 处 Apple 文档更新（${labelZh}）`
				: `本周期共捕获 ${stats.total_events} 处 Apple 官方文档变动（${labelZh}）`,
			overview: `本周期覆盖 ${stats.frameworks_touched} 个 Apple 框架与模块，共记录 ${stats.total_events} 条文档变动，其中高重要度更新 ${stats.high_significance} 条${addedCount ? `、新收录页面 ${addedCount} 篇` : ""}。`,
			strategy_notes: [
				topNames.length
					? `当前最活跃的更新模块集中在 ${topNames.join("、")}。`
					: "文档修订分散在多个官方模块中。",
				depCount > 0
					? `本周期发现 ${depCount} 项接口废弃预警，建议优先核对受影响的调用。`
					: "本周期未检测到新增 API 废弃标记。",
			],
			highlights: highlightsZh,
			alerts: alertsZh,
		},
	};
}

function buildDigestMessages(
	periodType: DigestPeriodType,
	periodKey: string,
	stats: DigestStats,
	events: readonly DocChangeEventItem[],
) {
	const evidenceLines = events.slice(0, 60).map((e) => {
		const parts = [
			`[${e.framework}]`,
			`[${e.change_kind}/${e.significance}]`,
			e.title,
			`| ${e.url}`,
			`| ${e.summary}`,
		];
		return parts.join(" ");
	});

	const systemPrompt = [
		"You are a senior Apple platform developer analyst writing a concise, factual Apple Developer Documentation intelligence brief.",
		"Analyze ONLY the verified change events provided. Never invent APIs, URLs, or facts not present in the input.",
		"Every URL in highlights[].urls and alerts[].url MUST be copied verbatim from the provided event lines.",
		"Output strictly valid JSON with top-level keys `en` (English) and `zh` (natural Simplified Chinese) matching this schema:",
		`{`,
		`  "en": { "headline": string, "overview": string, "strategy_notes": string[], "highlights": [{ "framework": string, "title": string, "summary": string, "urls": string[] }], "alerts": [{ "kind": "deprecated"|"beta"|"removed"|"breaking", "framework": string, "title": string, "note": string, "url": string }] },`,
		`  "zh": { "headline": string, "overview": string, "strategy_notes": string[], "highlights": [{ "framework": string, "title": string, "summary": string, "urls": string[] }], "alerts": [{ "kind": "deprecated"|"beta"|"removed"|"breaking", "framework": string, "title": string, "note": string, "url": string }] }`,
		`}`,
		"Keep headlines crisp (< 90 chars), strategy_notes 2-4 insightful bullets on Apple's documentation direction, highlights 3-5 grouped items, and alerts focused on real deprecations/beta changes/removals.",
		"Return JSON only with no markdown commentary.",
	].join("\n");

	const userPrompt = [
		`Period: ${periodType} (${periodKey})`,
		`Summary stats: ${JSON.stringify(stats)}`,
		`Verified change events (${evidenceLines.length} of ${stats.total_events}):`,
		...evidenceLines,
	].join("\n");

	return [
		{ role: "system" as const, content: systemPrompt },
		{ role: "user" as const, content: userPrompt },
	];
}

function createPgClient(env: Env) {
	return postgres({
		host: env.RAG_DB_HOST,
		port: Number.parseInt(env.RAG_DB_PORT || "5432", 10),
		database: env.RAG_DB_DATABASE,
		username: env.RAG_DB_USER,
		password: env.RAG_DB_PASSWORD || "",
		ssl: env.RAG_DB_SSLMODE !== "disable",
		max: 1,
		idle_timeout: 10,
		connect_timeout: 20,
		transform: { undefined: null },
		onnotice: () => {},
	});
}

async function callWorkersAI(
	ai: Ai,
	sql: postgres.Sql,
	messages: Array<{ role: "system" | "user"; content: string }>,
	allowedUrls: ReadonlySet<string>,
): Promise<{
	en: DigestLocaleContent;
	zh: DigestLocaleContent;
	model: string;
	neurons: number;
	inputTokens: number;
	outputTokens: number;
} | null> {
	const approxInputTokens = Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 3.5);
	const expectedOutputTokens = 2_400;

	const [usageRow] = await sql<{ neurons_used: number }[]>`
		SELECT COALESCE(neurons_used, 0)::int AS neurons_used
		FROM ai_neuron_usage
		WHERE day = CURRENT_DATE
	`;
	const usedToday = usageRow?.neurons_used ?? 0;

	for (const spec of WORKERS_AI_DIGEST_MODELS) {
		const projected = estimateNeurons(spec, approxInputTokens, expectedOutputTokens);
		if (usedToday + projected > DAILY_FREE_NEURON_LIMIT) {
			logger.info(
				`Skipping Workers AI model ${spec.id}: projected ${projected} neurons would exceed daily free cap (${usedToday}/${DAILY_FREE_NEURON_LIMIT})`,
			);
			continue;
		}

		try {
			const payload: Record<string, unknown> = {
				messages,
				max_tokens: 2600,
				temperature: 0.2,
			};
			if (spec.reasoningEffort) {
				payload.reasoning_effort = spec.reasoningEffort;
			}

			const raw = (await (
				ai as unknown as { run(model: string, input: Record<string, unknown>): Promise<unknown> }
			).run(spec.id, payload)) as Record<string, unknown>;

			const usage = raw?.usage as
				| { prompt_tokens?: number; completion_tokens?: number }
				| undefined;
			const inputTokens =
				typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : approxInputTokens;
			const outputTokens =
				typeof usage?.completion_tokens === "number"
					? usage.completion_tokens
					: Math.ceil(JSON.stringify(raw).length / 4);
			const neurons = estimateNeurons(spec, inputTokens, outputTokens);

			await sql`
				INSERT INTO ai_neuron_usage (day, neurons_used, calls, updated_at)
				VALUES (CURRENT_DATE, ${neurons}, 1, now())
				ON CONFLICT (day) DO UPDATE
				SET neurons_used = ai_neuron_usage.neurons_used + EXCLUDED.neurons_used,
				    calls = ai_neuron_usage.calls + 1,
				    updated_at = now()
			`;

			const json = extractJsonPayload(raw);
			const parsed = dualDigestSchema.safeParse(json);
			if (!parsed.success) {
				logger.warn(`Workers AI ${spec.id} returned invalid JSON schema; trying next model`);
				continue;
			}

			const sanitized = sanitizeDigestUrls(parsed.data, allowedUrls);
			return {
				...sanitized,
				model: spec.id,
				neurons,
				inputTokens,
				outputTokens,
			};
		} catch (error) {
			logger.warn(
				`Workers AI ${spec.id} failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	return null;
}

async function callZenMuxFallback(
	apiKey: string,
	messages: Array<{ role: "system" | "user"; content: string }>,
	allowedUrls: ReadonlySet<string>,
): Promise<{
	en: DigestLocaleContent;
	zh: DigestLocaleContent;
	model: string;
	inputTokens: number | null;
	outputTokens: number | null;
} | null> {
	try {
		const res = await fetch(ZENMUX_CHAT_ENDPOINT, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: ZENMUX_FALLBACK_MODEL,
				messages,
				max_tokens: 2400,
				temperature: 0.2,
				response_format: { type: "json_object" },
			}),
			signal: AbortSignal.timeout(35_000),
		});
		if (!res.ok) {
			logger.warn(`ZenMux digest fallback HTTP ${res.status}`);
			return null;
		}
		const body = (await res.json()) as Record<string, unknown>;
		const json = extractJsonPayload(body);
		const parsed = dualDigestSchema.safeParse(json);
		if (!parsed.success) {
			logger.warn("ZenMux digest fallback returned invalid JSON schema");
			return null;
		}
		const usage = body.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
		const sanitized = sanitizeDigestUrls(parsed.data, allowedUrls);
		return {
			...sanitized,
			model: ZENMUX_FALLBACK_MODEL,
			inputTokens: typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : null,
			outputTokens: typeof usage?.completion_tokens === "number" ? usage.completion_tokens : null,
		};
	} catch (error) {
		logger.warn(
			`ZenMux digest fallback failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
}

export async function generateDocDigest(
	env: Env,
	options: {
		periodType: DigestPeriodType;
		windowStart: Date;
		windowEnd: Date;
		periodKey: string;
		force?: boolean;
	},
): Promise<DocChangeDigest> {
	const sql = createPgClient(env);
	try {
		if (!options.force) {
			const [existing] = await sql<DocChangeDigest[]>`
				SELECT id::int, period_type, period_key, window_start, window_end, status,
				       provider, model, neurons_estimated::int, stats, content_en, content_zh, generated_at
				FROM doc_change_digests
				WHERE period_type = ${options.periodType} AND period_key = ${options.periodKey}
				LIMIT 1
			`;
			if (existing) return existing;
		}

		const events = await sql<DocChangeEventItem[]>`
			SELECT id::int, url, framework, title, symbol_kind, change_kind, significance,
			       sweep_source, summary, change_flags, diff_snippet, source_modified_at, detected_at
			FROM doc_change_events
			WHERE detected_at >= ${options.windowStart} AND detected_at < ${options.windowEnd}
			ORDER BY
				CASE significance WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ASC,
				detected_at DESC
			LIMIT 200
		`;

		const [counts] = await sql<
			{
				total_events: number;
				high_significance: number;
				frameworks_touched: number;
			}[]
		>`
			SELECT count(*)::int AS total_events,
			       count(*) FILTER (WHERE significance = 'high')::int AS high_significance,
			       count(DISTINCT framework)::int AS frameworks_touched
			FROM doc_change_events
			WHERE detected_at >= ${options.windowStart} AND detected_at < ${options.windowEnd}
		`;

		const kindRows = await sql<{ change_kind: string; count: number }[]>`
			SELECT change_kind, count(*)::int AS count
			FROM doc_change_events
			WHERE detected_at >= ${options.windowStart} AND detected_at < ${options.windowEnd}
			GROUP BY change_kind
		`;

		const fwRows = await sql<{ framework: string; count: number }[]>`
			SELECT framework, count(*)::int AS count
			FROM doc_change_events
			WHERE detected_at >= ${options.windowStart} AND detected_at < ${options.windowEnd}
			GROUP BY framework
			ORDER BY count DESC, framework ASC
			LIMIT 12
		`;

		const stats: DigestStats = {
			total_events: counts?.total_events ?? 0,
			high_significance: counts?.high_significance ?? 0,
			frameworks_touched: counts?.frameworks_touched ?? 0,
			by_kind: Object.fromEntries(kindRows.map((r) => [r.change_kind, r.count])),
			top_frameworks: fwRows,
		};

		let status: "ready" | "fallback" = "fallback";
		let provider = "rules";
		let model = "deterministic";
		let neuronsEstimated = 0;
		let inputTokens: number | null = null;
		let outputTokens: number | null = null;
		let contentEn: DigestLocaleContent;
		let contentZh: DigestLocaleContent;

		if (stats.total_events > 0) {
			const messages = buildDigestMessages(options.periodType, options.periodKey, stats, events);
			const allowedUrls = new Set(events.map((e) => e.url));

			const workersAiResult = env.AI
				? await callWorkersAI(env.AI, sql, messages, allowedUrls)
				: null;

			if (workersAiResult) {
				status = "ready";
				provider = "cloudflare-workers-ai";
				model = workersAiResult.model;
				neuronsEstimated = workersAiResult.neurons;
				inputTokens = workersAiResult.inputTokens;
				outputTokens = workersAiResult.outputTokens;
				contentEn = workersAiResult.en;
				contentZh = workersAiResult.zh;
			} else {
				const zenmuxResult = env.ZENMUX_API_KEY
					? await callZenMuxFallback(env.ZENMUX_API_KEY, messages, allowedUrls)
					: null;
				if (zenmuxResult) {
					status = "ready";
					provider = "zenmux";
					model = zenmuxResult.model;
					inputTokens = zenmuxResult.inputTokens;
					outputTokens = zenmuxResult.outputTokens;
					contentEn = zenmuxResult.en;
					contentZh = zenmuxResult.zh;
				} else {
					const fallback = buildDeterministicDigest(
						options.periodType,
						options.periodKey,
						stats,
						events,
					);
					contentEn = fallback.en;
					contentZh = fallback.zh;
				}
			}
		} else {
			const fallback = buildDeterministicDigest(
				options.periodType,
				options.periodKey,
				stats,
				events,
			);
			contentEn = fallback.en;
			contentZh = fallback.zh;
		}

		const [saved] = await sql<DocChangeDigest[]>`
			INSERT INTO doc_change_digests (
				period_type, period_key, window_start, window_end, status,
				provider, model, neurons_estimated, input_tokens, output_tokens,
				stats, content_en, content_zh, generated_at
			) VALUES (
				${options.periodType},
				${options.periodKey},
				${options.windowStart},
				${options.windowEnd},
				${status},
				${provider},
				${model},
				${neuronsEstimated},
				${inputTokens},
				${outputTokens},
				${JSON.stringify(stats)}::text::jsonb,
				${JSON.stringify(contentEn)}::text::jsonb,
				${JSON.stringify(contentZh)}::text::jsonb,
				now()
			)
			ON CONFLICT (period_type, period_key) DO UPDATE SET
				window_start = EXCLUDED.window_start,
				window_end = EXCLUDED.window_end,
				status = EXCLUDED.status,
				provider = EXCLUDED.provider,
				model = EXCLUDED.model,
				neurons_estimated = EXCLUDED.neurons_estimated,
				input_tokens = EXCLUDED.input_tokens,
				output_tokens = EXCLUDED.output_tokens,
				stats = EXCLUDED.stats,
				content_en = EXCLUDED.content_en,
				content_zh = EXCLUDED.content_zh,
				generated_at = now()
			RETURNING id::int, period_type, period_key, window_start, window_end, status,
			          provider, model, neurons_estimated::int, stats, content_en, content_zh, generated_at
		`;
		if (!saved) throw new Error("Failed to persist doc change digest");
		return saved;
	} finally {
		await sql.end().catch(() => {});
	}
}

export async function runScheduledDigests(env: Env, scheduledTime: number): Promise<void> {
	const now = new Date(scheduledTime);
	const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
	const dailyKey = formatUtcDayKey(yesterdayStart);
	const weekStart = new Date(todayStart.getTime() - 7 * 86_400_000);
	const weeklyKey = formatIsoWeekKey(yesterdayStart);

	// Fast single-query check: exit immediately (<2ms) when both current digests already exist.
	const sql = createPgClient(env);
	let hasDaily = false;
	let hasWeekly = false;
	try {
		const existing = await sql<{ period_type: string; period_key: string }[]>`
			SELECT period_type, period_key
			FROM doc_change_digests
			WHERE (period_type = 'daily' AND period_key = ${dailyKey})
			   OR (period_type = 'weekly' AND period_key = ${weeklyKey})
		`;
		hasDaily = existing.some((r) => r.period_type === "daily");
		hasWeekly = existing.some((r) => r.period_type === "weekly");
	} finally {
		await sql.end().catch(() => {});
	}

	const newlyPublishedUrls: string[] = [];

	if (!hasDaily) {
		try {
			const digest = await generateDocDigest(env, {
				periodType: "daily",
				periodKey: dailyKey,
				windowStart: yesterdayStart,
				windowEnd: todayStart,
			});
			newlyPublishedUrls.push(
				`${SITE_ORIGIN}/updates`,
				`${SITE_ORIGIN}/updates/digest/daily/${encodeURIComponent(dailyKey)}`,
				...digest.stats.top_frameworks
					.slice(0, 5)
					.map(
						(f) =>
							`${SITE_ORIGIN}/updates/framework/${encodeURIComponent(frameworkSlug(f.framework))}`,
					),
			);
		} catch (error) {
			await logger.error(
				`Scheduled daily doc digest (${dailyKey}) failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	if (!hasWeekly) {
		try {
			const digest = await generateDocDigest(env, {
				periodType: "weekly",
				periodKey: weeklyKey,
				windowStart: weekStart,
				windowEnd: todayStart,
			});
			newlyPublishedUrls.push(
				`${SITE_ORIGIN}/updates`,
				`${SITE_ORIGIN}/updates/digest/weekly/${encodeURIComponent(weeklyKey)}`,
				...digest.stats.top_frameworks
					.slice(0, 5)
					.map(
						(f) =>
							`${SITE_ORIGIN}/updates/framework/${encodeURIComponent(frameworkSlug(f.framework))}`,
					),
			);
		} catch (error) {
			await logger.error(
				`Scheduled weekly doc digest (${weeklyKey}) failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	if (newlyPublishedUrls.length > 0) {
		await submitIndexNow(newlyPublishedUrls);
	}
}
