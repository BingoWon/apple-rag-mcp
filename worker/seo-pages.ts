import postgres from "postgres";
import type {
	DigestPeriodType,
	DocChangeDigest,
	DocChangeEventItem,
} from "../shared/doc-updates.js";
import { SITE_ORIGIN, SITE_PAGES, siteStructuredJSON } from "../shared/site.js";
import type { Env } from "./shared/types.js";

const SEO_PAGE_TTL = 3600;
const FRAMEWORK_PAGE_TTL = 900;
const SITEMAP_TTL = 3600;

export interface ClientGuideSpec {
	readonly slug: string;
	readonly name: string;
	readonly clientHeader: string;
	readonly summary: string;
	readonly bestFor: string;
	readonly transportNote: string;
	readonly configTitle: string;
	readonly configCode: string;
	readonly installUrl?: string;
	readonly installLabel?: string;
	readonly steps: readonly string[];
	readonly samplePrompts: readonly string[];
}

export const CLIENT_GUIDES: readonly ClientGuideSpec[] = [
	{
		slug: "cursor",
		name: "Cursor",
		clientHeader: "cursor",
		summary:
			"Connect Apple RAG to Cursor in one click via remote Streamable HTTP MCP. Search 376,000+ Apple Developer doc pages and 1,880+ WWDC video transcripts without running any local server.",
		bestFor: "iOS, macOS, and SwiftUI developers using Cursor Composer and Agent mode",
		transportNote:
			"Supports both modern stateless MCP 2026-07-28 and legacy initialize handshakes required by Cursor.",
		configTitle: "~/.cursor/mcp.json",
		configCode: JSON.stringify(
			{
				mcpServers: {
					"apple-rag-mcp": {
						url: "https://mcp.apple-rag.com",
						headers: { "X-Apple-RAG-Client": "cursor" },
					},
				},
			},
			null,
			2,
		),
		installUrl:
			"https://cursor.com/en/install-mcp?name=apple-rag-mcp&config=eyJ1cmwiOiJodHRwczovL21jcC5hcHBsZS1yYWcuY29tIiwiaGVhZGVycyI6eyJYLUFwcGxlLVJBRy1DbGllbnQiOiJjdXJzb3IifX0%3D",
		installLabel: "One-Click Install in Cursor",
		steps: [
			"Click the One-Click Install button above, or add the JSON block to ~/.cursor/mcp.json.",
			"Reload MCP servers in Cursor Settings → Tools & MCP to verify search, browse, and fetch appear.",
			"Start immediately with 30 free anonymous calls/week — no API key required. Add an optional Bearer token from apple-rag.com/overview for 50 free calls/week or Pro ($1/week for 50,000 calls).",
		],
		samplePrompts: [
			"Use apple-rag-mcp to check the latest SwiftUI NavigationStack path restoration APIs and verify iOS availability.",
			"Search WWDC transcripts via apple-rag-mcp for migrating ObservableObject views to @Observable safely under Swift 6.",
			"Browse SwiftUI navigation topics and fetch the canonical StoreKit Transaction.currentEntitlements documentation.",
		],
	},
	{
		slug: "claude-code",
		name: "Claude Code",
		clientHeader: "claude",
		summary:
			"Add official Apple Developer documentation and WWDC transcripts to Claude Code with a single command — either as a remote HTTP MCP server or via apple-rag-cli + Agent Skill.",
		bestFor:
			"Terminal-native Swift, iOS, and full-stack developers building Apple apps with Claude Code",
		transportNote:
			"Native Streamable HTTP remote server with zero local daemon; also supports apple-rag-cli and the bundled apple-dev-docs skill.",
		configTitle: "Terminal command (user scope)",
		configCode: `claude mcp add-json --scope user apple-rag-mcp '{"type":"http","url":"https://mcp.apple-rag.com","headers":{"X-Apple-RAG-Client":"claude"}}'`,
		steps: [
			"Run the single claude mcp add-json command above in your terminal.",
			"Run /mcp inside Claude Code to verify apple-rag-mcp exposes search, browse, and fetch.",
			"Optional: install apple-rag-cli globally or add the apple-dev-docs skill from github.com/BingoWon/apple-rag-mcp for shell-based workflows.",
		],
		samplePrompts: [
			"Check Apple RAG for Swift 6 strict concurrency isolation rules around @MainActor and nonisolated async methods.",
			"Search Apple RAG for the latest SwiftData ModelContainer migration APIs and cite the official Apple URLs.",
			"Fetch the official AppIntents documentation and wire up a Siri shortcut cleanly without deprecated APIs.",
		],
	},
	{
		slug: "codex",
		name: "OpenAI Codex",
		clientHeader: "codex",
		summary:
			"Configure Apple RAG inside OpenAI Codex CLI or Codex desktop app using ~/.codex/config.toml so Codex verifies Apple APIs against official docs and WWDC sessions before writing Swift.",
		bestFor: "Developers using OpenAI Codex for iOS, macOS, visionOS, and SwiftUI projects",
		transportNote: "Direct remote Streamable HTTP endpoint configured cleanly in TOML.",
		configTitle: "~/.codex/config.toml",
		configCode: `[mcp_servers.apple-rag-mcp]\nurl = "https://mcp.apple-rag.com"\n\n[mcp_servers.apple-rag-mcp.http_headers]\nX-Apple-RAG-Client = "codex"`,
		steps: [
			"Append the [mcp_servers.apple-rag-mcp] block to ~/.codex/config.toml.",
			"Restart your Codex session so the search, browse, and fetch tools load.",
			"For sandboxed shell environments without remote MCP, run npm install -g apple-rag-cli and copy skills/apple-dev-docs/SKILL.md into ~/.agents/skills/apple-dev-docs/.",
		],
		samplePrompts: [
			"Use apple-rag-mcp to verify WidgetKit timeline reload limits and ControlWidget APIs before editing.",
			"Search WWDC transcripts for StoreKit 2 subscription status verification best practices.",
		],
	},
	{
		slug: "vscode",
		name: "VS Code (GitHub Copilot)",
		clientHeader: "vscode",
		summary:
			"Connect Apple RAG to VS Code and GitHub Copilot Agent Mode via standard .vscode/mcp.json remote HTTP configuration — zero local dependencies.",
		bestFor:
			"Cross-platform teams writing Swift, React Native iOS modules, or Flutter iOS plugins in VS Code",
		transportNote: "Standard VS Code Streamable HTTP MCP transport over HTTPS.",
		configTitle: ".vscode/mcp.json",
		configCode: JSON.stringify(
			{
				servers: {
					"apple-rag-mcp": {
						type: "http",
						url: "https://mcp.apple-rag.com",
						headers: { "X-Apple-RAG-Client": "vscode" },
					},
				},
			},
			null,
			2,
		),
		steps: [
			"Create or update .vscode/mcp.json in your workspace (or user settings.json).",
			"Click Start on apple-rag-mcp in VS Code to load search, browse, and fetch into Copilot Agent Mode.",
			"Sign in at apple-rag.com/overview anytime to add a Bearer token or authorize your static IP.",
		],
		samplePrompts: [
			"Search Apple docs via apple-rag-mcp for ASWebAuthenticationSession ephemeral session behavior on iOS.",
			"Fetch the UIKit UISheetPresentationController documentation and summarize detent sizing rules.",
		],
	},
	{
		slug: "windsurf",
		name: "Windsurf",
		clientHeader: "cursor",
		summary:
			"Give Windsurf Cascade instant access to official Apple developer docs, SwiftUI/UIKit topic trees, and WWDC video transcripts via remote HTTP MCP.",
		bestFor: "Developers building iOS and macOS apps with Windsurf Cascade",
		transportNote:
			"Remote Streamable HTTP MCP server with stateless 2026-07-28 and legacy compatibility.",
		configTitle: "~/.codeium/windsurf/mcp_config.json",
		configCode: JSON.stringify(
			{
				mcpServers: {
					"apple-rag-mcp": {
						serverUrl: "https://mcp.apple-rag.com",
					},
				},
			},
			null,
			2,
		),
		steps: [
			"Open Windsurf MCP settings and paste the server configuration above.",
			"Refresh MCP tools in Cascade and confirm search, browse, and fetch are active.",
			"Start with 30 anonymous calls/week free, or link an account for higher shared limits.",
		],
		samplePrompts: [
			"Check Apple RAG for current SwiftUI animation spring APIs and avoid deprecated UIKit wrappers.",
			"Search WWDC sessions for CloudKit sharing and CKSyncEngine conflict resolution.",
		],
	},
	{
		slug: "cline",
		name: "Cline",
		clientHeader: "cline",
		summary:
			"Connect Cline to Apple RAG over Streamable HTTP so autonomous multi-file Swift edits always reference canonical Apple API signatures and availability notes.",
		bestFor: "Developers running autonomous coding loops in Cline for iOS and Apple platforms",
		transportNote: "Direct remote streamableHttp MCP endpoint — no npx or local Docker container.",
		configTitle: "cline_mcp_settings.json",
		configCode: JSON.stringify(
			{
				mcpServers: {
					"apple-rag-mcp": {
						type: "streamableHttp",
						url: "https://mcp.apple-rag.com",
						headers: { "X-Apple-RAG-Client": "cline" },
					},
				},
			},
			null,
			2,
		),
		steps: [
			"Open Cline → MCP Servers → Configure MCP Servers and add the block above.",
			"Verify search, browse, and fetch appear with a green connected indicator.",
			"Add an Authorization Bearer token later if you need 50 free calls/week or Pro (50,000 calls/week for $1/week).",
		],
		samplePrompts: [
			"Before refactoring this CoreData stack to SwiftData, search Apple RAG for versioned schema migration caveats.",
		],
	},
	{
		slug: "trae",
		name: "TRAE",
		clientHeader: "trae",
		summary:
			"在 TRAE 中 10 秒接入 Apple RAG 云端 MCP，自动路由至中国大陆可用的决策重排引擎，零本地部署直查 Apple 官方文档与 WWDC 字幕。",
		bestFor: "使用 TRAE 开发 iOS / macOS / SwiftUI 应用的中国及全球开发者",
		transportNote:
			"原生支持 Streamable HTTP（https://mcp.apple-rag.com），中国大陆请求自动路由至 Microsoft Decision 1.1，支持支付宝与银行卡。",
		configTitle: "TRAE MCP 配置（JSON）",
		configCode: JSON.stringify(
			{
				mcpServers: {
					"apple-rag-mcp": {
						type: "http",
						url: "https://mcp.apple-rag.com",
						headers: { "X-Apple-RAG-Client": "trae" },
					},
				},
			},
			null,
			2,
		),
		steps: [
			"打开 TRAE 设置 → MCP → 手动添加，粘贴上方 JSON 配置。",
			"确认 search、browse、fetch 三个工具成功加载即可免登录直接体验（每周 30 次调用）。",
			"前往 apple-rag.com/overview 登录可免费升级到每周 50 次，重度开发可按周 $1 开通 Pro（支持支付宝，每周 50,000 次）。",
		],
		samplePrompts: [
			"通过 apple-rag-mcp 检索 Swift 6 并发隔离与 @MainActor 迁移最佳实践，并附官方链接。",
			"调用 apple-rag-mcp 的 browse 查看 SwiftUI 导航主题目录，避免使用已废弃 API。",
		],
	},
	{
		slug: "antigravity",
		name: "Antigravity",
		clientHeader: "antigravity",
		summary:
			"Wire Apple RAG into Antigravity via native Streamable HTTP MCP or apple-rag-cli so multi-step iOS/macOS engineering plans cite canonical Apple Developer docs.",
		bestFor: "Developers building and debugging Apple apps inside Antigravity",
		transportNote: "Stateless MCP 2026-07-28 endpoint plus compatible CLI skill.",
		configTitle: "MCP Server Configuration",
		configCode: JSON.stringify(
			{
				mcpServers: {
					"apple-rag-mcp": {
						serverUrl: "https://mcp.apple-rag.com",
						headers: { "X-Apple-RAG-Client": "antigravity" },
					},
				},
			},
			null,
			2,
		),
		steps: [
			"Add apple-rag-mcp to your Antigravity MCP configuration.",
			"Reload MCP servers and verify search, browse, and fetch are available.",
			"Optionally install apple-rag-cli (npm install -g apple-rag-cli) for direct terminal workflows.",
		],
		samplePrompts: [
			"Search Apple RAG for the latest SwiftUI GlassEffect / Liquid Glass APIs and confirm minimum OS version.",
		],
	},
	{
		slug: "opencode",
		name: "OpenCode",
		clientHeader: "opencode",
		summary:
			"Connect OpenCode to Apple RAG via remote MCP or apple-rag-cli for fast, compact Apple docs and WWDC transcript retrieval in terminal coding sessions.",
		bestFor: "Open-source terminal coding agent users working on Swift and Apple SDKs",
		transportNote: "Remote HTTP MCP plus standalone Node 22+ CLI package on npm.",
		configTitle: "opencode.json",
		configCode: JSON.stringify(
			{
				mcp: {
					"apple-rag-mcp": {
						type: "remote",
						url: "https://mcp.apple-rag.com",
						headers: { "X-Apple-RAG-Client": "opencode" },
					},
				},
			},
			null,
			2,
		),
		steps: [
			"Add the remote MCP server block to opencode.json.",
			"Restart OpenCode to expose search, browse, and fetch.",
			"Or run npm install -g apple-rag-cli && apple-rag search 'SwiftUI NavigationStack' --json directly.",
		],
		samplePrompts: [
			"Use apple-rag-mcp to look up RealityKit Entity component lifecycle methods from WWDC sessions.",
		],
	},
];

export interface ComparisonSpec {
	readonly slug: string;
	readonly competitorName: string;
	readonly competitorSummary: string;
	readonly title: string;
	readonly description: string;
	readonly verdict: string;
	readonly rows: readonly {
		readonly dimension: string;
		readonly appleRag: string;
		readonly competitor: string;
	}[];
	readonly chooseAppleRag: readonly string[];
	readonly chooseCompetitor: readonly string[];
}

export const COMPARISON_GUIDES: readonly ComparisonSpec[] = [
	{
		slug: "apple-docs-mcp",
		competitorName: "apple-docs-mcp (Local Node MCP)",
		competitorSummary:
			"Popular open-source local stdio MCP server (run via npx) that queries Apple's live web search and documentation endpoints from your machine.",
		title: "Apple RAG vs apple-docs-mcp — Remote Hybrid RAG vs Local Proxy",
		description:
			"Objective technical comparison of Apple RAG (hosted hybrid semantic + keyword search with Jev ranking and WWDC transcripts) vs local apple-docs-mcp.",
		verdict:
			"Choose local apple-docs-mcp if you want a simple free local script with zero external service. Choose Apple RAG if you want zero local setup, semantic + symbol hybrid retrieval across 376,000+ indexed Apple docs & 1,880+ WWDC transcripts, version-aware reranking, and a live 5-minute documentation change radar.",
		rows: [
			{
				dimension: "Deployment & Setup",
				appleRag:
					"Hosted Streamable HTTP (https://mcp.apple-rag.com) + optional CLI; 10s setup, zero local process",
				competitor: "Local Node.js stdio process via npx; runs on every client session",
			},
			{
				dimension: "Retrieval Architecture",
				appleRag:
					"Dual-track exact symbol + 2560-dim pgvector semantic recall, reranked by Jev / Microsoft Decision",
				competitor: "Direct upstream Apple web search and DocC JSON lookups",
			},
			{
				dimension: "WWDC Video Transcripts",
				appleRag: "1,880+ WWDC sessions indexed & chunked alongside official API docs",
				competitor: "Focused primarily on live documentation endpoint lookups",
			},
			{
				dimension: "Topic Navigation",
				appleRag:
					"Dedicated browse tool for SwiftUI & UIKit topic hierarchies + 4-stage resilient fetch",
				competitor: "Symbol / search endpoint traversal",
			},
			{
				dimension: "Freshness & Change Radar",
				appleRag:
					"Continuous 5-minute ETag radar with public diffs, deprecations & RSS at apple-rag.com/updates",
				competitor: "Live on-demand queries against Apple's site",
			},
			{
				dimension: "Pricing",
				appleRag:
					"Free anonymous (30/wk) & free account (50/wk); Pro $1/week (50,000/wk) including model costs",
				competitor: "Free open-source local execution",
			},
		],
		chooseAppleRag: [
			"You work across multiple machines, cloud IDEs, or clients (Cursor, Claude Code, Codex, VS Code) and want zero local daemon management.",
			"Your questions are conceptual or version-sensitive ('how to migrate @Observable under Swift 6') where semantic recall + WWDC transcripts + reranking dramatically cut hallucinations.",
			"You want both MCP and a first-class CLI (apple-rag-cli) sharing one quota.",
		],
		chooseCompetitor: [
			"You strictly require all requests to originate directly from your own local machine without any hosted intermediary.",
			"You prefer running a lightweight local npx server with zero account or quota concept.",
		],
	},
	{
		slug: "cupertino",
		competitorName: "Cupertino (Offline Local Index)",
		competitorSummary:
			"Swift-based offline Apple documentation crawler and SQLite FTS5 local search MCP server.",
		title: "Apple RAG vs Cupertino — Cloud Semantic RAG vs Offline SQLite FTS5",
		description:
			"Compare Apple RAG's managed cloud hybrid vector search & WWDC transcripts against Cupertino's offline Swift SQLite FTS5 local documentation crawler.",
		verdict:
			"Cupertino excels in air-gapped or fully offline environments where you are willing to crawl and store gigabytes locally. Apple RAG eliminates multi-gigabyte local crawls and adds dense semantic search, Jev decision reranking, WWDC transcripts, and continuous 5-minute updates.",
		rows: [
			{
				dimension: "Disk & Maintenance",
				appleRag: "0 MB local disk; corpus continuously crawled and re-embedded in the cloud",
				competitor: "Multi-GB local SQLite database; manual re-crawl needed for new SDKs",
			},
			{
				dimension: "Search Quality",
				appleRag: "Hybrid lexical + 2560-dim vector embeddings + Jev/Decision reranking",
				competitor: "SQLite FTS5 keyword / lexical full-text search",
			},
			{
				dimension: "WWDC Coverage",
				appleRag: "1,880+ WWDC video transcripts searchable alongside API docs",
				competitor: "Documentation corpus focus",
			},
			{
				dimension: "Offline Support",
				appleRag: "Requires internet connection (Cloudflare Workers edge)",
				competitor: "Works 100% offline once crawled",
			},
			{
				dimension: "Cross-Platform Support",
				appleRag: "macOS, Windows, Linux, cloud containers via HTTP MCP or Node CLI",
				competitor: "Swift-native, primarily macOS",
			},
		],
		chooseAppleRag: [
			"You don't want to dedicate hours crawling and gigabytes storing Apple documentation on every laptop.",
			"You ask natural-language or cross-framework architecture questions that need semantic recall and WWDC context.",
		],
		chooseCompetitor: [
			"You frequently code on flights or air-gapped networks with zero internet access.",
			"You want a purely local Swift binary and SQLite FTS5 index under your own control.",
		],
	},
	{
		slug: "sosumi",
		competitorName: "sosumi.ai (Apple Docs Markdown Proxy)",
		competitorSummary:
			"Clean hosted service by NSHipster that converts a known developer.apple.com URL into clean Markdown for LLMs.",
		title: "Apple RAG vs sosumi.ai — Full RAG Discovery vs Single-URL Markdown Proxy",
		description:
			"Understand the difference between Apple RAG's search + browse + fetch knowledge base and sosumi.ai's URL-to-Markdown proxy for Apple documentation.",
		verdict:
			"sosumi.ai is great when you already know the exact developer.apple.com URL you want converted to Markdown. Apple RAG solves the harder upstream problem: discovering which Apple APIs, SwiftUI topics, and WWDC talks actually answer your agent's question before fetching the canonical page.",
		rows: [
			{
				dimension: "Primary Job",
				appleRag: "End-to-end knowledge retrieval: search → browse topic tree → fetch full source",
				competitor: "Single-page URL conversion from Apple DocC HTML/JSON to Markdown",
			},
			{
				dimension: "When URL Is Unknown",
				appleRag:
					"Finds relevant docs & WWDC transcripts via hybrid semantic + symbol search + reranking",
				competitor: "Agent must already know or guess the exact Apple documentation URL",
			},
			{
				dimension: "WWDC Video Transcripts",
				appleRag: "1,880+ WWDC video transcripts indexed and searchable",
				competitor: "Single documentation page conversion",
			},
			{
				dimension: "Topic Hierarchy Exploration",
				appleRag: "Built-in browse tool for official SwiftUI & UIKit topic trees",
				competitor: "Follow links manually page by page",
			},
			{
				dimension: "Documentation Change Tracking",
				appleRag: "Live 5-minute ETag radar, structured diffs, and RSS at apple-rag.com/updates",
				competitor: "Not a change-tracking service",
			},
		],
		chooseAppleRag: [
			"Your AI coding agent needs to discover the right modern API, check deprecations, or reference WWDC talks without guessing URLs.",
			"You want one unified MCP/CLI workflow combining search, topic browsing, and resilient fetching.",
		],
		chooseCompetitor: [
			"You already have an exact developer.apple.com link and just want a quick web URL swap to view Markdown in a browser or curl.",
		],
	},
	{
		slug: "xcode-mcpbridge",
		competitorName: "Xcode xcrun mcpbridge (Apple Built-in)",
		competitorSummary:
			"Apple's official local Xcode MCP bridge (Xcode 26.3+) that lets coding agents inspect projects, edit files, trigger builds, run tests, and render SwiftUI previews.",
		title: "Apple RAG vs Xcode mcpbridge — Complementary Knowledge Brain & Local IDE Bridge",
		description:
			"Why Apple RAG and Apple's official xcrun mcpbridge are designed to work together: cloud Apple Docs & WWDC retrieval paired with local Xcode build/test execution.",
		verdict:
			"Apple RAG and Xcode's xcrun mcpbridge are complementary partners, not competitors. Use xcrun mcpbridge to build, test, and preview inside your local Xcode project; pair it with Apple RAG so your agent searches 376,000+ official docs and 1,880+ WWDC transcripts with version-aware reranking before writing code.",
		rows: [
			{
				dimension: "Core Responsibility",
				appleRag:
					"Cloud knowledge brain: search docs & WWDC, browse SwiftUI/UIKit topics, fetch web/DocC pages",
				competitor:
					"Local IDE executor: read/edit Xcode project, build, run tests, SwiftUI previews",
			},
			{
				dimension: "Requires Local Xcode Running",
				appleRag: "No — works on macOS, Linux, Windows, CI, and remote cloud sandboxes",
				competitor: "Yes — requires macOS with Xcode open locally",
			},
			{
				dimension: "WWDC Video Transcripts",
				appleRag: "1,880+ WWDC talks indexed and ranked for API & migration advice",
				competitor: "Local SDK/project context only",
			},
			{
				dimension: "Cross-Version & Deprecation Radar",
				appleRag:
					"Live 5-minute documentation diff radar and deprecation alerts at apple-rag.com/updates",
				competitor: "Bound to the single installed Xcode SDK version",
			},
			{
				dimension: "Recommended Setup",
				appleRag:
					"Run BOTH side-by-side in Cursor / Claude Code / Codex for research + compile/test loop",
				competitor:
					"Run BOTH side-by-side: Apple RAG researches the right API, mcpbridge builds & verifies",
			},
		],
		chooseAppleRag: [
			"You want your agent to search WWDC transcripts, compare OS version changes, or look up APIs outside the currently installed local Xcode.",
			"You develop on Linux/Windows/cloud agents or want Cursor/Claude Code to write correct Swift on the first compile attempt.",
		],
		chooseCompetitor: [
			"You need local Xcode build diagnostics, unit test execution, simulator control, or SwiftUI Preview rendering (pair both together for best results!).",
		],
	},
];

export const CURATED_FRAMEWORKS: readonly {
	readonly slug: string;
	readonly name: string;
	readonly blurb: string;
}[] = [
	{
		slug: "swiftui",
		name: "SwiftUI",
		blurb: "Declarative UI framework across iOS, macOS, watchOS, tvOS, and visionOS.",
	},
	{
		slug: "uikit",
		name: "UIKit",
		blurb: "Core iOS, iPadOS, and tvOS interface and app lifecycle framework.",
	},
	{
		slug: "foundation",
		name: "Foundation",
		blurb: "Essential data types, collections, networking, formatting, and OS services.",
	},
	{
		slug: "storekit",
		name: "StoreKit",
		blurb: "In-app purchases, subscriptions, entitlements, and App Store commerce APIs.",
	},
	{
		slug: "swift",
		name: "Swift",
		blurb: "Swift standard library, concurrency, macros, and language documentation.",
	},
	{
		slug: "swiftdata",
		name: "SwiftData",
		blurb: "Declarative persistence and schema migration framework built for Swift.",
	},
	{
		slug: "appkit",
		name: "AppKit",
		blurb: "Native macOS windowing, menus, documents, and desktop UI framework.",
	},
	{
		slug: "appintents",
		name: "AppIntents",
		blurb:
			"System integration for Siri, Shortcuts, Spotlight, Action Button, and Apple Intelligence.",
	},
	{
		slug: "widgetkit",
		name: "WidgetKit",
		blurb: "Home Screen, Lock Screen, StandBy, Control Center, and Live Activity extensions.",
	},
	{
		slug: "realitykit",
		name: "RealityKit",
		blurb: "3D rendering, spatial computing, entities, and visionOS scene APIs.",
	},
	{
		slug: "metal",
		name: "Metal",
		blurb: "Low-overhead GPU graphics and compute shader framework.",
	},
	{
		slug: "coreml",
		name: "CoreML",
		blurb: "On-device machine learning model integration and inference APIs.",
	},
	{
		slug: "vision",
		name: "Vision",
		blurb: "Computer vision, text recognition, image analysis, and pose tracking.",
	},
	{
		slug: "cloudkit",
		name: "CloudKit",
		blurb: "iCloud structured data storage, sharing, and CKSyncEngine synchronization.",
	},
	{
		slug: "coredata",
		name: "CoreData",
		blurb: "Object graph management and persistent store framework.",
	},
	{
		slug: "avfoundation",
		name: "AVFoundation",
		blurb: "Audiovisual capture, playback, editing, and media processing.",
	},
	{
		slug: "mapkit",
		name: "MapKit",
		blurb: "Embedded maps, annotations, Look Around, and place search APIs.",
	},
	{
		slug: "healthkit",
		name: "HealthKit",
		blurb: "Privacy-first health and fitness data repository and workout APIs.",
	},
	{
		slug: "webkit",
		name: "WebKit",
		blurb: "Web content rendering, WKWebView, and JavaScript bridge APIs.",
	},
	{
		slug: "security",
		name: "Security",
		blurb: "Keychain Services, certificates, cryptography, and trust evaluation.",
	},
	{
		slug: "observation",
		name: "Observation",
		blurb: "Swift @Observable macro and fine-grained state tracking.",
	},
	{ slug: "combine", name: "Combine", blurb: "Declarative reactive event processing framework." },
	{
		slug: "foundationmodels",
		name: "FoundationModels",
		blurb: "On-device Apple Intelligence foundation model APIs for Swift apps.",
	},
	{
		slug: "xcode-release-notes",
		name: "Xcode Release Notes",
		blurb: "Official Xcode SDK, compiler, simulator, and toolchain release notes.",
	},
];

const CURATED_BY_SLUG = new Map(CURATED_FRAMEWORKS.map((fw) => [fw.slug, fw]));

export function frameworkSlug(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
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
		connect_timeout: 8,
		prepare: false,
		connection: {
			application_name: "apple-rag-seo",
			statement_timeout: 8_000,
		},
		transform: { undefined: null },
		onnotice: () => {},
	});
}

async function withEdgeCache(
	requestUrl: string,
	ttlSeconds: number,
	waitUntil: (promise: Promise<unknown>) => void,
	producer: () => Promise<Response>,
): Promise<Response> {
	const cache = typeof caches !== "undefined" ? caches.default : null;
	const cacheKey = new Request(requestUrl, { method: "GET" });
	if (cache) {
		const hit = await cache.match(cacheKey);
		if (hit) return hit;
	}
	const response = await producer();
	if (cache && response.ok && ttlSeconds > 0) {
		waitUntil(cache.put(cacheKey, response.clone()));
	}
	return response;
}

function renderShell(options: {
	title: string;
	description: string;
	canonicalPath: string;
	ogType?: string;
	structuredData: unknown;
	breadcrumbs: readonly { label: string; href?: string }[];
	bodyHtml: string;
	refTag: string;
}): string {
	const canonical = `${SITE_ORIGIN}${options.canonicalPath}`;
	const ogImage = `${SITE_ORIGIN}/og-image.png`;
	const breadcrumbHtml = options.breadcrumbs
		.map((item) =>
			item.href
				? `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`
				: `<span>${escapeHtml(item.label)}</span>`,
		)
		.join('<span class="sep" aria-hidden="true">/</span>');

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(options.title)}</title>
<meta name="description" content="${escapeHtml(options.description)}" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<link rel="icon" type="image/svg+xml" href="/logo.svg" />
<link rel="alternate" type="application/rss+xml" title="Apple RAG — Apple Developer Docs Pulse" href="${SITE_ORIGIN}/api/updates/rss.xml" />
<meta property="og:type" content="${escapeHtml(options.ogType ?? "article")}" />
<meta property="og:site_name" content="Apple RAG" />
<meta property="og:title" content="${escapeHtml(options.title)}" />
<meta property="og:description" content="${escapeHtml(options.description)}" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:image" content="${escapeHtml(ogImage)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(options.title)}" />
<meta name="twitter:description" content="${escapeHtml(options.description)}" />
<meta name="twitter:image" content="${escapeHtml(ogImage)}" />
<script type="application/ld+json">${siteStructuredJSON(options.structuredData)}</script>
<style>
:root{color-scheme:light dark;--bg:#ffffff;--surface:#f7f8fa;--card:#ffffff;--fg:#0f172a;--muted:#475569;--subtle:#64748b;--border:#e2e8f0;--brand:#2563eb;--brand-bg:#eff6ff;--warn:#d97706;--warn-bg:#fffbeb;--danger:#dc2626;--danger-bg:#fef2f2;--ok:#16a34a;--ok-bg:#f0fdf4;--code-bg:#0f172a;--code-fg:#f8fafc}
@media(prefers-color-scheme:dark){:root{--bg:#0b0f17;--surface:#111827;--card:#131b2b;--fg:#f1f5f9;--muted:#cbd5e1;--subtle:#94a3b8;--border:#1e293b;--brand:#60a5fa;--brand-bg:rgba(59,130,246,.14);--warn:#fbbf24;--warn-bg:rgba(245,158,11,.14);--danger:#f87171;--danger-bg:rgba(239,68,68,.14);--ok:#4ade80;--ok-bg:rgba(34,197,94,.14);--code-bg:#020617;--code-fg:#e2e8f0}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--brand);text-decoration:none}
a:hover{text-decoration:underline}
.topbar{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.topbar-inner{max-width:960px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.brand{display:inline-flex;align-items:center;gap:10px;font-weight:700;color:var(--fg);font-size:15px}
.brand img{width:26px;height:26px}
.nav{display:flex;align-items:center;gap:18px;font-size:14px;flex-wrap:wrap}
.nav a{color:var(--muted);font-weight:500}
.nav a.btn{background:var(--brand);color:#fff;padding:7px 14px;border-radius:999px;font-weight:600}
.nav a.btn:hover{text-decoration:none;opacity:.92}
main{max-width:960px;margin:0 auto;padding:28px 20px 64px}
.crumbs{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--subtle);margin-bottom:16px;flex-wrap:wrap}
.crumbs .sep{opacity:.5}
h1{font-size:clamp(26px,4vw,38px);line-height:1.2;letter-spacing:-.02em;margin:0 0 12px}
h2{font-size:21px;line-height:1.3;margin:32px 0 12px;letter-spacing:-.01em}
h3{font-size:16px;line-height:1.4;margin:18px 0 6px}
p.lead{font-size:17px;color:var(--muted);margin:0 0 20px}
.badges{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px}
.badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--muted)}
.badge.brand{background:var(--brand-bg);color:var(--brand);border-color:transparent}
.badge.warn{background:var(--warn-bg);color:var(--warn);border-color:transparent}
.badge.danger{background:var(--danger-bg);color:var(--danger);border-color:transparent}
.badge.ok{background:var(--ok-bg);color:var(--ok);border-color:transparent}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px;margin:16px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:16px 0}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px}
.stat .k{font-size:12px;color:var(--subtle);text-transform:uppercase;letter-spacing:.04em}
.stat .v{font-size:24px;font-weight:700;margin-top:4px;font-variant-numeric:tabular-nums}
pre{background:var(--code-bg);color:var(--code-fg);padding:16px;border-radius:12px;overflow-x:auto;font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;margin:12px 0}
code{font:13.5px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
table{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}
th,td{text-align:left;padding:11px 12px;border-bottom:1px solid var(--border);vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--subtle);background:var(--surface)}
ul,ol{padding-left:20px;margin:10px 0}
li{margin:6px 0}
.cta-row{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}
.cta-primary,.cta-secondary{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:10px;font-weight:600;font-size:14px}
.cta-primary{background:var(--brand);color:#fff}
.cta-primary:hover{text-decoration:none;opacity:.92}
.cta-secondary{background:var(--surface);color:var(--fg);border:1px solid var(--border)}
.cta-secondary:hover{text-decoration:none;border-color:var(--brand)}
.cta-box{background:var(--brand-bg);border:1px solid color-mix(in srgb,var(--brand) 30%,var(--border));border-radius:16px;padding:24px;margin:36px 0 24px}
.cta-box h2{margin-top:0}
.pill-links{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.pill-links a{font-size:13px;padding:5px 11px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--fg)}
.pill-links a:hover{border-color:var(--brand);text-decoration:none}
footer{border-top:1px solid var(--border);padding:24px 20px;font-size:13px;color:var(--subtle);text-align:center}
footer a{color:var(--muted);margin:0 8px}
</style>
</head>
<body>
<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="/?ref=${encodeURIComponent(options.refTag)}">
      <img src="/logo.svg" alt="Apple RAG" width="26" height="26" />
      <span>Apple RAG</span>
    </a>
    <nav class="nav" aria-label="Primary">
      <a href="/connect?ref=${encodeURIComponent(options.refTag)}">Connect MCP / CLI</a>
      <a href="/updates?ref=${encodeURIComponent(options.refTag)}">Docs Pulse</a>
      <a href="/vs/apple-docs-mcp">Compare</a>
      <a href="https://github.com/BingoWon/apple-rag-mcp" rel="noopener">GitHub</a>
      <a class="btn" href="/register?ref=${encodeURIComponent(options.refTag)}">Try Free · Pro $1/wk</a>
    </nav>
  </div>
</header>
<main>
  <nav class="crumbs" aria-label="Breadcrumb">${breadcrumbHtml}</nav>
  ${options.bodyHtml}
  <section class="cta-box">
    <h2>Keep Your AI Agent Synced With Official Apple Docs</h2>
    <p>Connect Cursor, Claude Code, Codex, VS Code, or any shell agent to <strong>376,000+ Apple Developer doc pages</strong> and <strong>1,880+ WWDC video transcripts</strong>. Hybrid search + Jev decision reranking. Start free with <strong>30 anonymous calls/week</strong> (no key), <strong>50 calls/week</strong> with a free account, or unlock <strong>50,000 calls/week for $1/week</strong>.</p>
    <div class="cta-row">
      <a class="cta-primary" href="/connect?ref=${encodeURIComponent(options.refTag)}">Connect via MCP or CLI →</a>
      <a class="cta-secondary" href="/register?ref=${encodeURIComponent(options.refTag)}">Create Free Account</a>
      <a class="cta-secondary" href="/updates?ref=${encodeURIComponent(options.refTag)}">Open Live Docs Pulse</a>
    </div>
  </section>
</main>
<footer>
  <div>Apple RAG — Official Apple Developer Knowledge for AI Agents (MCP &amp; CLI)</div>
  <div style="margin-top:8px">
    <a href="/">Home</a>
    <a href="/connect">Connect</a>
    <a href="/updates">Docs Pulse</a>
    <a href="/api/updates/rss.xml">RSS Feed</a>
    <a href="/sitemap.xml">Sitemap</a>
    <a href="/privacy-policy">Privacy</a>
    <a href="/terms-of-service">Terms</a>
  </div>
</footer>
</body>
</html>`;
}

function htmlResponse(html: string, status: number, ttlSeconds: number): Response {
	return new Response(html, {
		status,
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"X-Robots-Tag": status === 200 ? "index, follow" : "noindex, nofollow",
			"Cache-Control":
				status === 200
					? `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}, stale-while-revalidate=300`
					: "no-store",
		},
	});
}

export function renderClientGuidePage(slug: string): Response | null {
	const spec = CLIENT_GUIDES.find((item) => item.slug === slug);
	if (!spec) return null;

	const title = `Apple Docs MCP & CLI for ${spec.name} — Official Apple Documentation & WWDC | Apple RAG`;
	const description = spec.summary;
	const canonicalPath = `/connect/${spec.slug}`;
	const refTag = `seo_connect_${spec.slug}`;
	const otherClients = CLIENT_GUIDES.filter((item) => item.slug !== spec.slug)
		.map((item) => `<a href="/connect/${escapeHtml(item.slug)}">${escapeHtml(item.name)}</a>`)
		.join("");

	const bodyHtml = `
  <div class="badges">
    <span class="badge brand">MCP 2026-07-28 + Legacy</span>
    <span class="badge ok">Free 30 calls/wk (No Key)</span>
    <span class="badge">Pro $1/week · 50,000 calls</span>
  </div>
  <h1>Connect Apple Developer Docs &amp; WWDC to ${escapeHtml(spec.name)}</h1>
  <p class="lead">${escapeHtml(spec.summary)}</p>
  <div class="cta-row">
    ${
			spec.installUrl
				? `<a class="cta-primary" href="${escapeHtml(spec.installUrl)}" rel="noopener">${escapeHtml(spec.installLabel || `Install in ${spec.name}`)}</a>`
				: ""
		}
    <a class="${spec.installUrl ? "cta-secondary" : "cta-primary"}" href="/connect?ref=${encodeURIComponent(refTag)}">Copy Interactive Setup Prompt</a>
    <a class="cta-secondary" href="/overview?ref=${encodeURIComponent(refTag)}">Get Personal Account Token</a>
  </div>

  <div class="grid">
    <div class="stat"><div class="k">Apple Doc Pages</div><div class="v">376,000+</div></div>
    <div class="stat"><div class="k">WWDC Transcripts</div><div class="v">1,880+</div></div>
    <div class="stat"><div class="k">Tools Exposed</div><div class="v">search · browse · fetch</div></div>
    <div class="stat"><div class="k">Freshness Radar</div><div class="v">Every 5 min</div></div>
  </div>

  <h2>1. Configuration (${escapeHtml(spec.configTitle)})</h2>
  <p>${escapeHtml(spec.transportNote)}</p>
  <pre><code>${escapeHtml(spec.configCode)}</code></pre>

  <h2>2. Step-by-Step Setup</h2>
  <ol>${spec.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>

  <h2>3. CLI Alternative (Shell Agents &amp; Automation)</h2>
  <p>Prefer shell tools or CI scripts? Install <code>apple-rag-cli</code> (Node.js 22.20+) — it exposes the exact same <code>search</code>, <code>browse</code>, and <code>fetch</code> tools and shares your account quota:</p>
  <pre><code>npm install -g apple-rag-cli
apple-rag search "SwiftUI NavigationStack path binding" --limit 3 --json
apple-rag browse "https://developer.apple.com/documentation/swiftui/view" --depth 1</code></pre>

  <h2>4. Example Prompts to Try in ${escapeHtml(spec.name)}</h2>
  <ul>${spec.samplePrompts.map((p) => `<li>“${escapeHtml(p)}”</li>`).join("")}</ul>

  <h2>5. Other Supported Clients &amp; Comparisons</h2>
  <div class="pill-links">${otherClients}</div>
  <div class="pill-links">
    ${COMPARISON_GUIDES.map((c) => `<a href="/vs/${escapeHtml(c.slug)}">Apple RAG vs ${escapeHtml(c.competitorName)}</a>`).join("")}
  </div>`;

	const structuredData = {
		"@context": "https://schema.org",
		"@type": "HowTo",
		name: `How to connect Apple Developer Documentation MCP to ${spec.name}`,
		description,
		url: `${SITE_ORIGIN}${canonicalPath}`,
		totalTime: "PT1M",
		tool: [
			{ "@type": "HowToTool", name: spec.name },
			{ "@type": "HowToTool", name: "Apple RAG MCP" },
		],
		step: spec.steps.map((text, index) => ({
			"@type": "HowToStep",
			position: index + 1,
			text,
		})),
	};

	return htmlResponse(
		renderShell({
			title,
			description,
			canonicalPath,
			ogType: "website",
			structuredData,
			breadcrumbs: [
				{ label: "Home", href: "/" },
				{ label: "Connect", href: "/connect" },
				{ label: spec.name },
			],
			bodyHtml,
			refTag,
		}),
		200,
		SEO_PAGE_TTL,
	);
}

export function renderComparisonPage(slug: string): Response | null {
	const spec = COMPARISON_GUIDES.find((item) => item.slug === slug);
	if (!spec) return null;

	const canonicalPath = `/vs/${spec.slug}`;
	const refTag = `seo_vs_${spec.slug}`;
	const rowsHtml = spec.rows
		.map(
			(row) =>
				`<tr><td><strong>${escapeHtml(row.dimension)}</strong></td><td>${escapeHtml(row.appleRag)}</td><td>${escapeHtml(row.competitor)}</td></tr>`,
		)
		.join("");

	const bodyHtml = `
  <div class="badges">
    <span class="badge brand">Technical Comparison</span>
    <span class="badge">MCP &amp; CLI</span>
    <span class="badge ok">Updated 2026</span>
  </div>
  <h1>${escapeHtml(spec.title)}</h1>
  <p class="lead">${escapeHtml(spec.description)}</p>

  <div class="card">
    <h2 style="margin-top:0">Short Verdict</h2>
    <p style="margin-bottom:0">${escapeHtml(spec.verdict)}</p>
  </div>

  <h2>Feature-by-Feature Comparison</h2>
  <table>
    <thead>
      <tr>
        <th style="width:22%">Dimension</th>
        <th style="width:39%">Apple RAG</th>
        <th style="width:39%">${escapeHtml(spec.competitorName)}</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="grid">
    <div class="card">
      <h3 style="margin-top:0">When Apple RAG Fits Best</h3>
      <ul>${spec.chooseAppleRag.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
    <div class="card">
      <h3 style="margin-top:0">When ${escapeHtml(spec.competitorName)} Fits Best</h3>
      <ul>${spec.chooseCompetitor.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  </div>

  <h2>More Comparisons &amp; Client Setup Guides</h2>
  <div class="pill-links">
    ${COMPARISON_GUIDES.filter((c) => c.slug !== spec.slug)
			.map((c) => `<a href="/vs/${escapeHtml(c.slug)}">vs ${escapeHtml(c.competitorName)}</a>`)
			.join("")}
  </div>
  <div class="pill-links">
    ${CLIENT_GUIDES.map((g) => `<a href="/connect/${escapeHtml(g.slug)}">Connect ${escapeHtml(g.name)}</a>`).join("")}
  </div>`;

	const structuredData = {
		"@context": "https://schema.org",
		"@type": "TechArticle",
		headline: spec.title,
		description: spec.description,
		url: `${SITE_ORIGIN}${canonicalPath}`,
		author: { "@type": "Organization", name: "Apple RAG", url: SITE_ORIGIN },
		publisher: { "@type": "Organization", name: "Apple RAG", url: SITE_ORIGIN },
	};

	return htmlResponse(
		renderShell({
			title: `${spec.title} | Apple RAG`,
			description: spec.description,
			canonicalPath,
			structuredData,
			breadcrumbs: [
				{ label: "Home", href: "/" },
				{ label: "Compare", href: "/vs/apple-docs-mcp" },
				{ label: spec.competitorName },
			],
			bodyHtml,
			refTag,
		}),
		200,
		SEO_PAGE_TTL,
	);
}

export async function renderDigestPage(
	env: Env,
	requestUrl: string,
	waitUntil: (promise: Promise<unknown>) => void,
	periodRaw: string,
	periodKey: string,
): Promise<Response> {
	if (periodRaw !== "daily" && periodRaw !== "weekly") {
		return new Response("Not Found", { status: 404 });
	}
	const period: DigestPeriodType = periodRaw;
	if (!/^\d{4}-(?:\d{2}-\d{2}|W\d{2})$/.test(periodKey)) {
		return new Response("Not Found", { status: 404 });
	}

	const cacheUrl = `${SITE_ORIGIN}/updates/digest/${period}/${periodKey}`;
	return withEdgeCache(cacheUrl, SEO_PAGE_TTL, waitUntil, async () => {
		const sql = createPgClient(env);
		try {
			const [digestRows, recentRows] = await Promise.all([
				sql<DocChangeDigest[]>`
					SELECT id::int, period_type, period_key, window_start, window_end, status,
					       provider, model, neurons_estimated::int, stats, content_en, content_zh, generated_at
					FROM doc_change_digests
					WHERE period_type = ${period} AND period_key = ${periodKey}
					LIMIT 1
				`,
				sql<Pick<DocChangeDigest, "period_type" | "period_key" | "content_en">[]>`
					SELECT period_type, period_key, content_en
					FROM doc_change_digests
					WHERE period_type = ${period}
					ORDER BY period_key DESC
					LIMIT 8
				`,
			]);

			const digest = digestRows[0];
			if (!digest) return new Response("Digest not found", { status: 404 });

			const events = await sql<DocChangeEventItem[]>`
				SELECT id::int, url, framework, title, symbol_kind, change_kind, significance,
				       sweep_source, summary, change_flags, diff_snippet, source_modified_at, detected_at
				FROM doc_change_events
				WHERE detected_at >= ${new Date(digest.window_start)}
				  AND detected_at < ${new Date(digest.window_end)}
				ORDER BY CASE significance WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ASC,
				         detected_at DESC
				LIMIT 20
			`;

			const periodLabel = period === "weekly" ? "Weekly Digest" : "Daily Digest";
			const title = `${digest.content_en.headline} — Apple Docs Pulse (${periodKey}) | Apple RAG`;
			const description = digest.content_en.overview.slice(0, 160);
			const canonicalPath = `/updates/digest/${period}/${encodeURIComponent(periodKey)}`;
			const refTag = `seo_digest_${period}`;
			const generatedIso = new Date(digest.generated_at).toISOString();

			const fwLinks = (digest.stats.top_frameworks ?? [])
				.slice(0, 10)
				.map(
					(fw) =>
						`<a href="/updates/framework/${encodeURIComponent(frameworkSlug(fw.framework))}">${escapeHtml(fw.framework)} (${fw.count})</a>`,
				)
				.join("");

			const highlightsHtml = digest.content_en.highlights.length
				? `<h2>Key Framework Highlights</h2>
				   ${digest.content_en.highlights
							.map(
								(h) => `<div class="card">
						<div class="badges"><a class="badge brand" href="/updates/framework/${encodeURIComponent(frameworkSlug(h.framework))}">${escapeHtml(h.framework)}</a></div>
						<h3 style="margin-top:0">${escapeHtml(h.title)}</h3>
						<p>${escapeHtml(h.summary)}</p>
						${
							h.urls.length
								? `<ul>${h.urls.map((u) => `<li><a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${escapeHtml(u)}</a></li>`).join("")}</ul>`
								: ""
						}
					</div>`,
							)
							.join("")}`
				: "";

			const alertsHtml = digest.content_en.alerts.length
				? `<h2>Deprecation, Beta &amp; Removal Alerts</h2>
				   ${digest.content_en.alerts
							.map(
								(a) => `<div class="card">
						<div class="badges">
							<span class="badge ${a.kind === "removed" || a.kind === "breaking" ? "danger" : "warn"}">${escapeHtml(a.kind.toUpperCase())}</span>
							<a class="badge" href="/updates/framework/${encodeURIComponent(frameworkSlug(a.framework))}">${escapeHtml(a.framework)}</a>
						</div>
						<h3 style="margin-top:0"><a href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.title)}</a></h3>
						<p style="margin-bottom:0">${escapeHtml(a.note)}</p>
					</div>`,
							)
							.join("")}`
				: "";

			const eventsHtml = events.length
				? `<h2>Verified Documentation Changes (${events.length} Sampled)</h2>
				   <table>
				     <thead><tr><th>Framework</th><th>Change</th><th>Document</th></tr></thead>
				     <tbody>
				       ${events
									.map(
										(ev) => `<tr>
							<td><a href="/updates/framework/${encodeURIComponent(frameworkSlug(ev.framework))}">${escapeHtml(ev.framework)}</a></td>
							<td><span class="badge">${escapeHtml(ev.change_kind)}</span></td>
							<td>
								<strong><a href="${escapeHtml(ev.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ev.title)}</a></strong>
								<div style="color:var(--muted);font-size:13px;margin-top:4px">${escapeHtml(ev.summary)}</div>
							</td>
						</tr>`,
									)
									.join("")}
				     </tbody>
				   </table>`
				: "";

			const zhHtml = digest.content_zh?.headline
				? `<section class="card" lang="zh-CN">
				     <h2 style="margin-top:0">中文摘要 · ${escapeHtml(digest.content_zh.headline)}</h2>
				     <p>${escapeHtml(digest.content_zh.overview)}</p>
				     ${
								digest.content_zh.strategy_notes.length
									? `<ul>${digest.content_zh.strategy_notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
									: ""
}
				   </section>`
				: "";

			const recentHtml = recentRows
				.filter((r) => r.period_key !== periodKey)
				.slice(0, 6)
				.map(
					(r) =>
						`<a href="/updates/digest/${r.period_type}/${encodeURIComponent(r.period_key)}">${escapeHtml(r.period_key)}</a>`,
				)
				.join("");

			const bodyHtml = `
  <div class="badges">
    <span class="badge brand">Apple Docs Pulse · ${periodLabel}</span>
    <span class="badge">${escapeHtml(periodKey)}</span>
    <span class="badge ok">${digest.stats.total_events} tracked updates</span>
  </div>
  <h1>${escapeHtml(digest.content_en.headline)}</h1>
  <p class="lead">${escapeHtml(digest.content_en.overview)}</p>

  <div class="grid">
    <div class="stat"><div class="k">Total Changes</div><div class="v">${digest.stats.total_events}</div></div>
    <div class="stat"><div class="k">High Significance</div><div class="v">${digest.stats.high_significance}</div></div>
    <div class="stat"><div class="k">Frameworks Touched</div><div class="v">${digest.stats.frameworks_touched}</div></div>
    <div class="stat"><div class="k">Generated (UTC)</div><div class="v" style="font-size:15px">${escapeHtml(generatedIso.slice(0, 16).replace("T", " "))}</div></div>
  </div>

  ${
		digest.content_en.strategy_notes.length
			? `<h2>Key Takeaways</h2><ul>${digest.content_en.strategy_notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
			: ""
	}
  ${fwLinks ? `<h2>Most Active Apple Frameworks</h2><div class="pill-links">${fwLinks}</div>` : ""}
  ${highlightsHtml}
  ${alertsHtml}
  ${eventsHtml}
  ${zhHtml}
  ${recentHtml ? `<h2>Recent ${periodLabel}s</h2><div class="pill-links">${recentHtml}</div>` : ""}`;

			const structuredData = {
				"@context": "https://schema.org",
				"@type": "TechArticle",
				headline: digest.content_en.headline,
				description: digest.content_en.overview,
				datePublished: generatedIso,
				dateModified: generatedIso,
				url: `${SITE_ORIGIN}${canonicalPath}`,
				mainEntityOfPage: `${SITE_ORIGIN}${canonicalPath}`,
				author: { "@type": "Organization", name: "Apple RAG", url: SITE_ORIGIN },
				publisher: { "@type": "Organization", name: "Apple RAG", url: SITE_ORIGIN },
			};

			return htmlResponse(
				renderShell({
					title,
					description,
					canonicalPath,
					structuredData,
					breadcrumbs: [
						{ label: "Home", href: "/" },
						{ label: "Docs Pulse", href: "/updates" },
						{ label: `${periodLabel} · ${periodKey}` },
					],
					bodyHtml,
					refTag,
				}),
				200,
				SEO_PAGE_TTL,
			);
		} catch (error) {
			console.error(
				`SSR digest page error (${requestUrl}): ${error instanceof Error ? error.message : String(error)}`,
			);
			return new Response("Service temporarily unavailable", { status: 503 });
		} finally {
			await sql.end().catch(() => {});
		}
	});
}

export async function renderFrameworkPage(
	env: Env,
	requestUrl: string,
	waitUntil: (promise: Promise<unknown>) => void,
	rawSlug: string,
): Promise<Response> {
	const slug = frameworkSlug(rawSlug);
	if (!slug || slug.length > 80) return new Response("Not Found", { status: 404 });

	const cacheUrl = `${SITE_ORIGIN}/updates/framework/${slug}`;
	return withEdgeCache(cacheUrl, FRAMEWORK_PAGE_TTL, waitUntil, async () => {
		const sql = createPgClient(env);
		try {
			const curated = CURATED_BY_SLUG.get(slug);
			const events = await sql<DocChangeEventItem[]>`
				SELECT id::int, url, framework, title, symbol_kind, change_kind, significance,
				       sweep_source, summary, change_flags, diff_snippet, source_modified_at, detected_at
				FROM doc_change_events
				WHERE regexp_replace(lower(framework), '[^a-z0-9]+', '-', 'g') = ${slug}
				  AND detected_at >= now() - interval '90 days'
				ORDER BY detected_at DESC, id DESC
				LIMIT 40
			`;

			if (!curated && events.length === 0) {
				return new Response("Framework not found", { status: 404 });
			}

			const displayName = events[0]?.framework ?? curated!.name;
			const blurb =
				curated?.blurb ??
				`Live Apple Developer documentation changelog and API diff tracker for ${displayName}.`;
			const now = Date.now();
			const count7d = events.filter(
				(e) => now - new Date(e.detected_at).getTime() <= 7 * 86_400_000,
			).length;
			const count30d = events.filter(
				(e) => now - new Date(e.detected_at).getTime() <= 30 * 86_400_000,
			).length;
			const depCount = events.filter(
				(e) => e.change_kind === "deprecated" || e.change_kind === "removed",
			).length;

			const title = `${displayName} Documentation Changes & API Changelog — Apple Docs Pulse | Apple RAG`;
			const description = `Live ${displayName} Apple Developer documentation updates, API diffs, deprecations, and beta changes monitored every 5 minutes. Query ${displayName} docs directly from Cursor, Claude Code, or Codex.`;
			const canonicalPath = `/updates/framework/${slug}`;
			const refTag = `seo_framework_${slug}`;

			const eventsTable = events.length
				? `<table>
				     <thead><tr><th>Date (UTC)</th><th>Type</th><th>Document &amp; Summary</th></tr></thead>
				     <tbody>
				       ${events
									.map(
										(ev) => `<tr>
							<td style="white-space:nowrap">${escapeHtml(new Date(ev.detected_at).toISOString().slice(0, 10))}</td>
							<td><span class="badge ${ev.change_kind === "deprecated" || ev.change_kind === "removed" ? "warn" : ""}">${escapeHtml(ev.change_kind)}</span></td>
							<td>
								<strong><a href="${escapeHtml(ev.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ev.title)}</a></strong>
								<div style="color:var(--muted);font-size:13px;margin-top:4px">${escapeHtml(ev.summary)}</div>
							</td>
						</tr>`,
									)
									.join("")}
				     </tbody>
				   </table>`
				: `<div class="card"><p style="margin:0">No documentation diffs were recorded for <strong>${escapeHtml(displayName)}</strong> in the last 90 days. Apple Docs Pulse continues checking official framework roots and release notes every 5 minutes via ETag.</p></div>`;

			const otherFrameworks = CURATED_FRAMEWORKS.filter((fw) => fw.slug !== slug)
				.slice(0, 14)
				.map((fw) => `<a href="/updates/framework/${fw.slug}">${escapeHtml(fw.name)}</a>`)
				.join("");

			const bodyHtml = `
  <div class="badges">
    <span class="badge brand">Apple Docs Pulse · Framework Radar</span>
    <span class="badge ok">Monitored Every 5 min</span>
  </div>
  <h1>${escapeHtml(displayName)} Official Documentation Changelog</h1>
  <p class="lead">${escapeHtml(blurb)}</p>

  <div class="grid">
    <div class="stat"><div class="k">Changes (7 Days)</div><div class="v">${count7d}</div></div>
    <div class="stat"><div class="k">Changes (30 Days)</div><div class="v">${count30d}</div></div>
    <div class="stat"><div class="k">Sampled (90 Days)</div><div class="v">${events.length}</div></div>
    <div class="stat"><div class="k">Deprecations / Removals</div><div class="v">${depCount}</div></div>
  </div>

  <h2>Query ${escapeHtml(displayName)} Docs Directly From Your AI Agent</h2>
  <p>Stop AI coding assistants from hallucinating deprecated ${escapeHtml(displayName)} APIs. Connect Apple RAG via MCP (<code>https://mcp.apple-rag.com</code>) or run the CLI:</p>
  <pre><code>npm install -g apple-rag-cli
apple-rag search "${escapeHtml(displayName)} latest API availability and migration" --limit 4 --json</code></pre>

  <h2>Recent ${escapeHtml(displayName)} Documentation Updates</h2>
  ${eventsTable}

  <h2>Track Other Apple Frameworks</h2>
  <div class="pill-links">${otherFrameworks}</div>`;

			const structuredData = {
				"@context": "https://schema.org",
				"@type": "CollectionPage",
				name: `${displayName} Documentation Changelog`,
				description,
				url: `${SITE_ORIGIN}${canonicalPath}`,
				isPartOf: { "@type": "WebSite", name: "Apple RAG", url: SITE_ORIGIN },
			};

			return htmlResponse(
				renderShell({
					title,
					description,
					canonicalPath,
					structuredData,
					breadcrumbs: [
						{ label: "Home", href: "/" },
						{ label: "Docs Pulse", href: "/updates" },
						{ label: displayName },
					],
					bodyHtml,
					refTag,
				}),
				200,
				FRAMEWORK_PAGE_TTL,
			);
		} catch (error) {
			console.error(
				`SSR framework page error (${requestUrl}): ${error instanceof Error ? error.message : String(error)}`,
			);
			return new Response("Service temporarily unavailable", { status: 503 });
		} finally {
			await sql.end().catch(() => {});
		}
	});
}

export async function renderDynamicSitemap(
	env: Env,
	requestUrl: string,
	waitUntil: (promise: Promise<unknown>) => void,
): Promise<Response> {
	const cacheUrl = `${SITE_ORIGIN}/sitemap.xml`;
	return withEdgeCache(cacheUrl, SITEMAP_TTL, waitUntil, async () => {
		const entries: Array<{ loc: string; lastmod?: string }> = [];
		const seen = new Set<string>();
		const push = (loc: string, lastmod?: string) => {
			if (seen.has(loc)) return;
			seen.add(loc);
			entries.push({ loc, lastmod });
		};

		for (const [path, page] of Object.entries(SITE_PAGES)) {
			if (page.indexable) push(`${SITE_ORIGIN}${path === "/" ? "/" : path}`);
		}
		for (const client of CLIENT_GUIDES) {
			push(`${SITE_ORIGIN}/connect/${client.slug}`);
		}
		for (const comp of COMPARISON_GUIDES) {
			push(`${SITE_ORIGIN}/vs/${comp.slug}`);
		}
		for (const fw of CURATED_FRAMEWORKS) {
			push(`${SITE_ORIGIN}/updates/framework/${fw.slug}`);
		}

		if (env.RAG_DB_HOST) {
			const sql = createPgClient(env);
			try {
				const [digests, activeFrameworks] = await Promise.all([
					sql<{ period_type: string; period_key: string; generated_at: string }[]>`
						SELECT period_type, period_key, generated_at
						FROM doc_change_digests
						ORDER BY generated_at DESC
						LIMIT 84
					`,
					sql<{ framework: string; last_seen: string }[]>`
						SELECT framework, MAX(detected_at) AS last_seen
						FROM doc_change_events
						WHERE detected_at >= now() - interval '90 days'
						GROUP BY framework
						ORDER BY COUNT(*) DESC
						LIMIT 40
					`,
				]);

				for (const d of digests) {
					push(
						`${SITE_ORIGIN}/updates/digest/${d.period_type}/${encodeURIComponent(d.period_key)}`,
						new Date(d.generated_at).toISOString().slice(0, 10),
					);
				}
				for (const fw of activeFrameworks) {
					const slug = frameworkSlug(fw.framework);
					if (slug) {
						push(
							`${SITE_ORIGIN}/updates/framework/${encodeURIComponent(slug)}`,
							new Date(fw.last_seen).toISOString().slice(0, 10),
						);
					}
				}
			} catch (error) {
				console.warn(
					`Dynamic sitemap PG fallback (${requestUrl}): ${error instanceof Error ? error.message : String(error)}`,
				);
			} finally {
				await sql.end().catch(() => {});
			}
		}

		const xmlBody = entries
			.map((entry) =>
				entry.lastmod
					? `<url><loc>${escapeXml(entry.loc)}</loc><lastmod>${escapeXml(entry.lastmod)}</lastmod></url>`
					: `<url><loc>${escapeXml(entry.loc)}</loc></url>`,
			)
			.join("\n");
		const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlBody}\n</urlset>`;

		return new Response(xml, {
			status: 200,
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
				"Cache-Control": `public, max-age=${SITEMAP_TTL}, s-maxage=${SITEMAP_TTL}`,
			},
		});
	});
}
