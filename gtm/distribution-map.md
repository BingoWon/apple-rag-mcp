# Distribution Map

Checked 2026-10-19. Scope: every channel worth listing or launching Apple RAG MCP
and its Agent Skill. Ordered by leverage per hour, not by audience size.

## Strategy

Three different assets travel on different rails:

| Asset | What it is | Where it goes |
| --- | --- | --- |
| MCP server listing | Remote endpoint `https://mcp.apple-rag.com`, no auth or bearer token | MCP registries, client directories |
| Agent Skill | `skills/apple-dev-docs/` | Skill marketplaces, plugin bundles |
| Plugin / extension | Skill + `.mcp.json` bundled for one client | Claude Code, Cursor, Gemini CLI, VS Code, JetBrains |
| CLI package | `npx apple-rag-mcp` that writes client config | npm, Homebrew, registry package verification |

Publish to the official registry first. Glama and PulseMCP ingest it, and several
smaller directories are built from it or from the two big GitHub lists. Every
other listing is a separate, smaller multiplier.

## Tier 0 — must do, cascades into the rest

| Channel | Submit | Requirement | Cost | Notes |
| --- | --- | --- | --- | --- |
| Official MCP Registry | `mcp-publisher` CLI + `server.json` | Namespace via GitHub or DNS TXT; remote servers use a `remotes` block | Free | Many directories crawl it. A published version cannot be edited or deleted. |
| Glama | glama.ai — Add MCP Server, then claim the crawled page | GitHub repo or HTTPS URL | Free | Grades quality and health; claim to control the copy. |
| Smithery | smithery.ai — connect the server | Server must be up; it reads the tool list live | Free | Instant listing when inspection passes. |
| mcp.so | mcp.so/submit | Repo URL or server URL | Free, or $39 for instant + followed link | Largest MCP marketplace by traffic. |
| Claude directory | claude.ai/directory/manage | Paid Claude plan; remote HTTPS; OAuth or no auth for public data | No fee | Listed as Community by default; reviewed. |
| OpenAI plugin directory | platform.openai.com/plugins | Verified identity, domain check, test cases, video, plugin ZIP | No fee | Cannot promote subscriptions or upgrades inside the plugin — a free-only bundle is safer. |
| GitHub MCP Registry | Publish to official registry, then email per GitHub guide | Curated; feeds the VS Code `@mcp` gallery | No fee | Small (hundreds of servers); nofollow links. |
| Cursor Directory | cursor.directory/plugins/new | Repo with `.mcp.json` or plugin manifest | Free | Community path, faster than the curated store. |
| Cursor Marketplace | cursor.com/marketplace/publish | Open-source plugin, manual review | Free | Separate queue from cursor.directory; no status page. |

## Tier 1 — MCP directories worth a form

| Channel | How | Cost | Notes |
| --- | --- | --- | --- |
| LobeHub | `lhm` CLI, `lhm plugin publish` | Free | Needs repo push access. |
| Cline MCP Marketplace | GitHub issue in `cline/mcp-marketplace` | Free | Wants a 400×400 PNG logo and a one-click install README. |
| Docker MCP Catalog | PR to `docker/mcp-registry` | Free | Remote servers need `server.yaml`, empty `tools.json`, readme. Review can be slow. |
| PulseMCP | No form; publishes from the official registry | Free | Submissions paused as of October 2026. |
| mcpservers.org | Web form | Free, or $39 for speed | Free link is nofollow. |
| MCP Market (mcpmarket.com) | GitHub repo (free) or hosted URL ($29–69) | Freemium | Same listing, two prices. |
| MCP.Directory | Crawls GitHub | Free | Closed-source servers cannot get in. |
| LibHunt | Repository URL | Free | Instant approval, followed link. |
| MCPFind | mcpfind.org form | Free | ~6.7k servers, category browse. |
| mcp.tc | mcp.tc/submit | Free | Connects and writes the page in minutes. |
| mcpnav.net | Form | Free | 21k+ index, manual review. |
| mcpnav.dev | No form | Free | Built from the official registry and the two awesome-mcp lists. |
| The MCP Index | themcpindex.com/submit | Free | Registry sync within a day, manual otherwise. |
| Few Servers | fewservers.com/mcp/submit | Free | Reads the registry daily; form is for claims. |
| Launch MCP | launchmcp.co/submit | Free | Community listing needs 3 upvotes and a verified badge. |
| mcpub | `/.well-known/mcp.json` then API `submit` | Free | Open directory, no gatekeepers. |
| MCP Repository | Public GitHub repo URL | Free | Repo-only submission. |
| Agentry | URL form | Free | Accepts MCP endpoint URL as a type. |
| MCP Server Finder | Email | Free | Reads GitHub only; small. |
| mcpnavi (JP) | mcpnavi.jp form | Free | Japanese directory; useful for JP reach. |

## Tier 2 — Skill and plugin marketplaces

| Channel | How | Notes |
| --- | --- | --- |
| Agensi | ZIP + listing (done) | Live submission under review. No off-platform paid upsell. |
| skills.sh | No form: `npx skills add <repo>` telemetry | Appears only after real installs; no crawler. |
| SkillsMP | skillsmp.com submission | Auto-index plus form. |
| ClaudeSkills.info | claudeskills.info form | Auto-index plus form. |
| ClaudeMarketplaces | claudemarketplaces.com form | Lists skills, servers, and marketplaces. |
| Claude Plugin Hub | claudepluginhub.com form | Form plus branded page. |
| SkillKit | skillkit.io/submit | Public GitHub repo required. |
| AugmentClaude | augmentclaude.com/submit | One-command install catalog. |
| Skills.pub | skills.pub/en/submit | Review form. |
| DD Skills | skills.developersdigest.tech/submit | PR against `lib/skills.ts`. |
| Claude Skills Hub | claudeskill.site | Community marketplace. |
| OpenClaw / ClawHub | Skill repo and registry | Verify current submission path before relying on it. |
| Gemini CLI extensions | Public repo + topic `gemini-cli-extension` | Auto-indexed in the gallery; also a review form at geminicliextensions.com/submit. |
| Claude Code plugin directory | Bundle skill + `.mcp.json`, submit via Anthropic directory | Highest-value bundle for Claude Code users. |
| VS Code | Companion extension or GitHub MCP registry | The `@mcp` gallery reads the GitHub registry. |
| JetBrains Marketplace | Companion plugin that registers the server | Reaches IntelliJ users. |
| Awesome lists | PRs: travisvn/awesome-claude-skills, VoltAgent/awesome-agent-skills, Chat2AnyLLM/awesome-claude-skills, ranbot-ai/awesome-skills, monkky/awesome-claude-plugins | No AI-slop entries; add a real install path. |

## Tier 3 — launch and community

| Channel | How | Reality check |
| --- | --- | --- |
| Hacker News Show HN | news.ycombinator.com/submit | Works only with a technical story, not a product pitch. |
| Product Hunt | producthunt.com/launch | Average dev-tool launch gets ~144 upvotes. Start 30 days early; do not expect revenue. |
| Reddit | r/mcp, r/ClaudeAI, r/cursor, r/LocalLLaMA, r/ChatGPTCoding, r/iOSProgramming, r/swift, r/macosprogramming | Read each sub's self-promo rules; value-first posts only. |
| MCP Discord | discord.com/servers/model-context-protocol-1312302100125843476 | Ask for the server-author flair; share in the right channel. |
| Cursor Forum | forum.cursor.com | Answer real MCP setup questions; link only when relevant. |
| Newsletters | MCP Newsletter (beehiiv), PulseMCP newsletter, TLDR AI, Ben's Bites, The Rundown, Superhuman, Latent Space, How I AI | Pitch a concrete finding, not a launch announcement. |
| YouTube / Bilibili | 60–90s demo of the agent answering a real API question | Screen recording beats slides. |
| X / LinkedIn / Bluesky / Mastodon | Build-in-public thread with before/after | Cross-post with canonical links. |
| dev.to / Hashnode / Medium / Substack | Tutorial: "Why your agent hallucinates deprecated Apple APIs" | Canonical URL back to our site. |
| Indie Hackers / Lobsters | Show-and-tell | Small, high-signal. |
| Conferences | AGNTCon + MCPCon (Oct 22–23, 2026, San Jose), MCP Dev Summits, try! Swift, SwiftConf, NSSpain, iOS Conf SG | Too late to speak at MCPCon 2026; attend and pitch 2027. |

## Tier 4 — Apple and Swift vertical

| Channel | How | Status |
| --- | --- | --- |
| iOS Dev Weekly | suggest.iosdevweekly.com | Active; issue 772 on 2026-10-16. Best single Apple channel. |
| SwiftUI Weekly | weekly.swiftwithmajid.com | Active; pitch Majid directly. |
| iOS Goodies | ios-goodies.com | Weekly iOS newsletter; pitch the curator. |
| Kodeco | Tutorial pitch | Large beginner-to-intermediate iOS audience. |
| SwiftLee (Antoine van der Lee) | Blog/newsletter pitch | Active Swift content. |
| Donny Wals | Blog/podcast pitch | Deep Swift/iOS audience. |
| Hacking with Swift (Paul Hudson) | Newsletter/tutorial pitch | Huge Swift audience. |
| Swift Forums | forums.swift.org | Participate, do not drop links. |
| Apple Developer Forums | developer.apple.com/forums | Answer tooling questions. |
| Podcasts | Swift by Sundell, Stacktrace, Under the Radar | Pitch a demo, not an ad. |
| ~~Swift Weekly Brief~~ | — | Closed; removed from the old channel tracker. |

## Tier 5 — China

| Channel | Format | Notes |
| --- | --- | --- |
| 掘金 | Tutorial article | Strong dev SEO; tag MCP / iOS / AI. |
| 知乎 | Answer + article | "AI 写 iOS 代码总用过时 API" angle. |
| V2EX | 分享创造 node | Self-promo tolerated with a free trial. |
| 少数派 | Workflow tutorial | Pays for quality; long lead time. |
| 即刻 | Short build-in-public posts | Indie dev community. |
| Bilibili | 3–5 min demo video | Screen recording + commentary. |
| 微信公众号 | Long-form article | Owned audience; repost from blog. |
| CSDN / 阿里云 / 腾讯云开发者社区 | Republished tutorial | SEO backlinks. |
| InfoQ / 开源中国 | News or project listing | Pitch the maintainer angle. |
| Gitee | Mirror repo + GVP application | Chinese discoverability. |
| AI 产品榜 (aicpb.com) | Product listing | Chinese AI product directory. |
| 新智元 / 机器之心 | Media pitch | Only for a real milestone (users, funding, benchmark). |
| Generic AI tool directories | aiworknav.cn, laicaila.com, naobang.com, aidb.live, vanetools.com | Cheap backlinks; low intent. Vanetools charges. |

## SEO and AI-search assets

- `public/llms.txt` already exists; keep it current.
- Publish comparison pages: our server vs generic web search vs other Apple MCP servers.
- Add GitHub topics: `mcp`, `mcp-server`, `model-context-protocol`, `claude-skills`, `agent-skills`, `apple`, `ios`, `swiftui`.
- Ship an npm CLI (`npx apple-rag-mcp`) with `mcpName` in `package.json`: gives npm discovery, a universal installer, and satisfies package-ownership checks if we ever publish a package-based registry entry.
- Keep the README first screen installable in under 30 seconds; directories copy it.

## Do not bother yet

- Paid placement on mcp.so / mcpservers.org / mcpmarket before organic listings prove conversion.
- Generic AI tool directories with no developer audience.
- Newsletter blasts bought from list vendors.
- Reposting the same launch text to every subreddit on the same day.

## Execution order

1. **Week 1:** official registry → Glama claim → Smithery → mcp.so → Cursor Directory → Claude directory → GitHub MCP Registry email.
2. **Week 1:** two awesome-list PRs with a one-line install path.
3. **Week 2:** Tier 1 forms (10–15 minutes each), then skill marketplaces.
4. **Week 2:** build the Claude Code plugin bundle and the Gemini CLI extension; submit both.
5. **Week 3:** one tutorial post, one demo video, Show HN, then Reddit and newsletters.
6. **Week 4:** Apple vertical pitches (iOS Dev Weekly first), then China reposts.

## Measurement

Use one URL per channel (`?ref=glama`, `?ref=smithery`, …) on the endpoint landing
page, and check GitHub referrers. Track: listing live, referral visits, signups,
tool calls, and paid conversion. Kill channels that produce visits but no signups
after 30 days.
