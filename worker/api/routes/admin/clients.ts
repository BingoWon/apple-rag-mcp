import { createRoute, z } from "@hono/zod-openapi";
import {
	CLIENT_PAGE_SIZE,
	type ClientPeriod,
	type ClientRow,
	clientDetails,
	clientDimension,
	clientFamily,
	clientPeriod,
	clientReport,
} from "../../../../shared/client-usage.js";
import { TOOL_KINDS } from "../../../../shared/tool-activity.js";
import { TOOL_CHANNELS, type ToolChannel } from "../../../../shared/tool-channels.js";
import { logWindowPredicate, logWindowValues } from "../../utils/activity.js";
import { createOpenAPIApp } from "../../utils/openapi.js";

const app = createOpenAPIApp();
const counts = `COUNT(*) calls,COUNT(DISTINCT account) accounts,COUNT(account) account_calls,
 COUNT(*) FILTER(WHERE tool='search') search,COUNT(*) FILTER(WHERE tool='browse') browse,
 COUNT(*) FILTER(WHERE tool='fetch') fetch,COUNT(*) FILTER(WHERE status_code BETWEEN 200 AND 299) ok,
 COUNT(*) FILTER(WHERE status_code=429) limited`;

// Match the first product token, never client names buried in a URL or comment.
const familySQL = `CASE
 WHEN ua='' THEN 'missing'
 WHEN agent='opencode' THEN 'opencode'
 WHEN agent='claude-code' THEN 'claude'
 WHEN agent='codex-mcp-client' OR (agent='openai-mcp' AND instr(ua,'(codex)')>0) THEN 'codex'
 WHEN agent IN ('dsh-mcp-client','deepseek-harness','deepseek harness') THEN 'deepseek-harness'
 WHEN agent='workbuddy' THEN 'workbuddy'
 WHEN agent IN ('trae','trae-cn') THEN 'trae'
 WHEN agent='pi-coding-agent' THEN 'pi'
 WHEN agent IN ('vscode','vscode-insiders') THEN 'vscode'
 WHEN agent='cline' THEN 'cline'
 WHEN agent='antigravity' THEN 'antigravity'
 WHEN agent='cursor' THEN 'cursor'
 WHEN agent='apple-rag-cli' THEN 'apple_cli'
 WHEN agent IN ('brickbluebot','kitscout-livecheck','mcpyp-incremental','faceabotprobe','teppi-probe','agentvalcon-collector',
 'agent-collector','agent-index','evyai mcp check','rokmcp-collector','storkmcpdirectory','botco-mcp-check','mcp-ad-measurement') THEN 'probe'
 WHEN agent IN ('curl','python-urllib','python-httpx','python-httpx2','python-requests','python-aiohttp','go-http-client','undici','node','mozilla') THEN 'http'
 ELSE 'unrecognized' END`;

function callSource(period: ClientPeriod, end: string, channel?: ToolChannel) {
	const days = period === "all" ? null : ({ "24h": 1, "7d": 7, "30d": 30 } as const)[period];
	const start = days === null ? null : new Date(Date.parse(end) - days * 86400000).toISOString();
	const predicate = start
		? logWindowPredicate
		: "(julianday(created_at)<julianday(?) OR julianday(created_at) IS NULL)";
	const values = start ? logWindowValues(start, end) : [end];
	if (channel) values.push(channel);
	const union = TOOL_KINDS.map(
		(tool) => `SELECT '${tool}' tool,channel,user_id,status_code,
 lower(trim(coalesce(client_name,''))) ua,client_version,reported_client FROM ${tool}_logs
 WHERE ${predicate}${channel ? " AND channel=?" : ""}`,
	).join(" UNION ALL ");
	const sql = `WITH raw AS (${union}), tokens AS (
 SELECT *,substr(ua,1,instr(ua||'/','/')-1) agent FROM raw
 ), detected AS (SELECT *,${familySQL} ua_family FROM tokens),
 classified AS (SELECT *,coalesce(reported_client,ua_family) family FROM detected)`;
	return { start, sql, params: TOOL_KINDS.flatMap(() => values) };
}

app.openapi(
	createRoute({
		method: "get",
		path: "/",
		summary: "Client attribution across logged tool calls",
		request: { query: z.object({ period: clientPeriod.default("7d") }) },
		responses: {
			200: {
				description: "Distinct account and request counts at each grouping level",
				content: {
					"application/json": {
						schema: z.object({ success: z.literal(true), data: clientReport }),
					},
				},
			},
		},
	}),
	async (c) => {
		const end = new Date(Date.now()).toISOString();
		const { sql, params, start } = callSource(c.req.valid("query").period, end);
		// Identical accounts can use multiple products and channels. Count each level from the same snapshot.
		const { results } = await c.env.DB.prepare(`${sql}, activity AS MATERIALIZED (
 SELECT channel,family,tool,status_code,u.id account FROM classified LEFT JOIN users u ON u.id=classified.user_id)
 SELECT NULL channel,NULL family,${counts} FROM activity UNION ALL
 SELECT channel,NULL family,${counts} FROM activity GROUP BY channel UNION ALL
 SELECT channel,family,${counts} FROM activity GROUP BY channel,family
 ORDER BY channel,calls DESC,family`)
			.bind(...params)
			.all<ClientRow>();
		c.header("Cache-Control", "private, no-store");
		return c.json({ success: true as const, data: { start, end, rows: results } });
	},
);

const detailQuery = z.object({
	period: clientPeriod,
	end: z.iso
		.datetime()
		.refine((v) => Date.parse(v) <= Date.now(), "Window end must not be in the future"),
	channel: z.enum(TOOL_CHANNELS),
	family: clientFamily,
	dimension: clientDimension.default("environment"),
	page: z.coerce.number().int().min(1).max(1000000).default(1),
});
app.openapi(
	createRoute({
		method: "get",
		path: "/breakdown",
		summary: "Paged environments or versions for a reported client",
		request: { query: detailQuery },
		responses: {
			200: {
				description: "Aggregate counts for the selected snapshot",
				content: {
					"application/json": {
						schema: z.object({ success: z.literal(true), data: clientDetails }),
					},
				},
			},
		},
	}),
	async (c) => {
		const q = c.req.valid("query");
		const { sql, params } = callSource(q.period, q.end, q.channel);
		// Only known integration names and version-shaped tokens may leave the database.
		const environment = `CASE
 WHEN family='unrecognized' AND length(agent) BETWEEN 2 AND 28 AND agent GLOB '[a-z]*' AND agent NOT GLOB '*[^a-z-]*'
 AND tail GLOB '[0-9]*' THEN agent
 WHEN family!=ua_family THEN NULL
 WHEN family IN ('probe','http') THEN CASE WHEN agent='mozilla' THEN 'browser' ELSE agent END
 WHEN family='claude' AND host IN ('claude-vscode','claude-desktop','cli','sdk-cli','t3-code') THEN host
 WHEN family='cursor' AND host IN ('darwin arm64','darwin x64','win32 x64','win32 arm64','linux x64','linux arm64') THEN host
 WHEN family='opencode' AND ua GLOB 'opencode/*/cli' THEN 'cli'
 ELSE NULL END`;
		const byVersion = q.dimension === "version";
		const key = byVersion ? "CASE WHEN family IN ('probe','http') THEN agent END" : environment;
		const version = byVersion
			? `CASE WHEN length(candidate) BETWEEN 1 AND 32
 AND candidate GLOB '[0-9]*' AND candidate NOT GLOB '*[^0-9a-z.+-]*'
 AND family=ua_family AND family NOT IN ('unrecognized','missing') AND agent!='mozilla' THEN candidate END`
			: "NULL";
		const result = await c.env.DB.prepare(`${sql}, parts AS (
 SELECT *,CASE WHEN family='opencode' AND ua LIKE 'opencode/latest/%' THEN substr(ua,17)
 ELSE substr(ua,instr(ua,'/')+1) END tail,
 ltrim(substr(ua,instr(ua,'(')+1)) host_tail FROM classified WHERE family=?
 ), parsed AS (SELECT *,
 CASE WHEN family='apple_cli' AND nullif(trim(client_version),'') IS NOT NULL THEN lower(trim(client_version))
 ELSE substr(tail,1,instr(replace(replace(tail,'/',' '),'(',' ')||' ',' ')-1) END candidate,
 substr(host_tail,1,instr(replace(host_tail,')',',')||',',',')-1) host FROM parts),
 variants AS (SELECT ${key} label,${version} version,COUNT(*) calls FROM parsed GROUP BY 1,2),
 page AS (SELECT * FROM variants ORDER BY calls DESC,label,version LIMIT ? OFFSET ?)
 SELECT page.*, groups_count FROM (SELECT COUNT(*) groups_count FROM variants) LEFT JOIN page ON 1
 ORDER BY calls DESC,label,version`)
			.bind(...params, q.family, CLIENT_PAGE_SIZE, (q.page - 1) * CLIENT_PAGE_SIZE)
			.all<{
				label: string | null;
				version: string | null;
				calls: number | null;
				groups_count: number;
			}>();
		c.header("Cache-Control", "private, no-store");
		return c.json({
			success: true as const,
			data: {
				total: result.results[0]?.groups_count ?? 0,
				rows: result.results.flatMap(({ label, version, calls }) =>
					calls === null ? [] : [{ label, version, calls }],
				),
			},
		});
	},
);
export default app;
