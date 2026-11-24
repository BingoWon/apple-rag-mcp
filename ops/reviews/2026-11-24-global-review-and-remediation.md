# Apple RAG 全局深度审查与系统整改记录（2026-11-24）

> **记录日期**：2026-11-24  
> **涉及版本**：`v5.15.12` → `v5.15.13`（服务端与官网），`apple-rag-cli@2.1.3` → `2.1.4`（CLI 与 bundled Skill）  
> **基线提交**：`4d16cf0`  
> **定位说明**：本文档记录接手项目后的顶层全局审查结论、按科学复现流程实施的代码与标准修复、经批判性评估刻意保留的历史设计、需在 VPS 手工生效的数据库配置，以及**供所有者审阅的 README 与官网首页文案优化提案**（首页与 README 正文暂未改动）。

---

## 1. 审查原则与工程约束

本次整改严格遵循以下三条原则：

1. **先复现、再量化、后验证**：每一处问题都先定位到确切代码与触发路径，补充自动化回归测试或实测前后量化指标，不靠猜测改代码。
2. **批判性甄别历史设计**：先核对 [`ops/architecture.md`](../architecture.md) 与历史事故文档，确认是真实缺陷才修复；属于有意为之的工程取舍则原样保留并记录理由。
3. **拒绝向后兼容“缝合怪”**：内部跨层引用、冗余薄包装、失效死代码直接彻底清理，只在对外公开协议与线上运行契约处保留必要兼容（如 MCP `legacy: "stateless"`、已发布 CLI 2.1.3 契约与现有 D1/PG 线上数据）。

---

## 2. 量化改进总览（Before vs. After）

| 观测维度 | 整改前（`v5.15.12` / `2.1.3`） | 整改后（`v5.15.13` / `2.1.4`） | 变化幅度 |
| --- | ---: | ---: | ---: |
| MCP `tools/list` 响应体积 | `21,342 bytes` | `12,295 bytes` | **-42.4%**（-9,047 B） |
| 前端 `canvas-reveal-effect` Chunk | `870 KB`（Three.js + R3F） | `1.9 KB`（纯 Canvas 2D） | **-99.8%** |
| 前端 `code-block` Chunk | `763 KB`（全量 Prism） | `59.9 KB`（`PrismLight` 3 语言） | **-92.1%** |
| 前端首屏入口 `index` Chunk | `540 KB` | `295.7 KB`（gzip `96.6 KB`） | **-45.2%** |
| 前端 `AccountOverlays` Chunk | `81 KB`（含 GSAP） | `13.4 KB`（Web Animations API） | **-83.4%** |
| 前端生产依赖包清理 | — | 移除 `three` / `@types/three` / `@react-three/fiber` / `gsap` | **-19 个安装子包** |
| 跨模块边界违规引用（`src↔worker`、`shared→worker`） | `20 处` | `0 处` | **100% 清零** |
| 自动化测试通过数（主仓 + CLI） | `280 pass`（261 + 19） | `304 pass`（282 + 22），`0 fail` | **+24 项回归用例** |

---

## 3. 已确认并落地的修复清单

### 3.1 检索核心、网页读取、采集器与数据库层

| 模块 | 文件 | 修复内容与验证信号 |
| --- | --- | --- |
| 多块合并完整性误判 | `worker/services/search-engine.ts` | `mergeByUrl()` 保留真实 `total_chunks`，不再覆盖为 `1`；完整合并的多块文档现在正确标记 `complete: true`，避免误导智能体重复 `fetch`。补充回归单测。 |
| 查询清洗误杀开发术语 | `worker/services/query-cleaner.ts` | 修正正则顺序与词表：不再误删 `may`、`reference`、`manual`、`guide`、`doc`、`1st`/`2nd`/`3rd`、三段版本号（`iOS 18.2.10`）及宽高比（`16:10`）；优先清理完整日期 `YYYY-MM-DD`。新增完整单测文件 `query-cleaner.test.ts`。 |
| `fetch` 预算滥用与队列污染 | `worker/services/page-reader.ts`、`worker/services/tool-service.ts` | 入队高优采集前强制经过 `canCacheUrl` 校验（带 query string 的 Apple URL 不再污染 `pages` 队列）；实时调用 Firecrawl 消耗全局每日预算后即使目标站返回 4xx 也标记 `spentProviderBudget` 不再退还用户配额，阻断 0 配额打爆全站预算；反爬拦截特征校验改为锚定且限定短正文（`< 2000` 字符），避免误杀正文含 `Access Denied` 标题的技术文档。 |
| 纯 IPv4 域名 SSRF 误杀 | `worker/shared/web-url.ts` | `assertPublicHost` 对 `A` 与 `AAAA` 记录改为 `Promise.allSettled`，在继续拦截双栈私网 IPv6 的前提下兼容 `AAAA` 返回 `NOTIMP`/`SERVFAIL` 的纯 IPv4 站点。补充回归单测。 |
| DocC 路径翻倍与采集保护 | `worker/collector/AppleAPIClient.ts`、`worker/collector/hls-subtitles.ts` | 修复 `/documentation/docc` 拼出双重 `/documentation/documentation/docc/` 的路径错误；解码视频 `og:title` 中的 HTML 实体并校验码点范围；`fetchDocuments` 限制并发度为 `6` 以贴合 Workers 出站连接限制；`HLS_MAX_SEGMENTS` 从 `2000` 下调至 `400` 防止突破 Workers 1,000 子请求硬上限。 |
| 重排摘要、脱敏与 PG/D1 稳健性 | `worker/services/reranker.ts`、`worker/services/model-alerts.ts`、`worker/shared/postgres-retry.ts`、`worker/services/database.ts`、`worker/collector/handler.ts`、`worker/services/d1-utils.ts`、`worker/services/rate-limit.ts` | 修复 `excerpt()` 在 `start === 0` 时的重复拼接；为 `qwenScores` 候选增加字节上限；补齐 `SILICONFLOW_API_KEY` 电报脱敏；PG 重试纳入错误码 `53300`；统一 PG TLS 默认开启、`max: 2`、`prepare: false`、`statement_timeout: 15_000`、`rebuildClient` 互斥锁及 `WHERE url IN (...)` 单查询；`raceWithTimeout` 清理定时器，限流读写补齐 `withD1Timeout`。 |

### 3.2 MCP 协议与官方标准对齐

- **打破循环依赖与统一工具注册**：消除 `mcp` ↔ `mcp-auth` ↔ `services` 三角循环依赖；删除 `worker/mcp/tools/{search-tool,fetch-tool}.ts` 薄包装，统一由 `worker/mcp/tools.ts` 注册 `search`、`browse`、`fetch` 三工具。
- **修复 Legacy Batch 提前关库竞态**：`worker/mcp/protocol-handler.ts` 改为追踪 `activeToolCalls` 集合并在 `finally` 中 `Promise.allSettled` 等待全部工具结束再关闭 `database`；鉴权提前至 `servicesFactory()` 之前执行；`worker/index.ts` 为后台 `waitUntil` 补 `.catch(() => {})`。
- **收缩 `tools/list` 并补全官方注解**：`outputSchema` 移除错误联合分支（SDK 在 `isError: true` 时跳过校验），使 `tools/list` 从 **21,342 B 降至 12,295 B（-42.4%）**；补齐 `title`、`idempotentHint: true`、`openWorldHint`（`search`/`browse`: `false`，`fetch`: `true`）。
- **补齐发现文件、鉴权头与 CORS**：`mcp.apple-rag.com/.well-known/mcp.json` 正式提供服务并与主站及 `manifest.ts` 同步 `browse` 描述；`server.json` 补报可选头 `X-Apple-RAG-Client`；`formatBrowseResponse` 补匿名配额提示页脚；`/mcp/account` 与 CLI 401 统一返回 `WWW-Authenticate`；规范 CORS 允许头（`Mcp-Session-Id`、`Last-Event-ID`、`X-Apple-RAG-Version`）、暴露 `WWW-Authenticate` 并统一不支持方法的 405 响应。

### 3.3 REST API、认证、账单与管理后台

- **接通全局错误电报告警**：`worker/shared/logger.ts` 新增 `setGlobalAlertUrl()` 并在 Worker 入口与 `apiApp` 中间件统一挂载，修复长期以来 API/MCP 侧 `logger.error()` 告警静默丢失的问题。
- **安全加固**：
  - 删除无鉴权、无调用方的死接口 `POST /api/mcp-tokens/validate`；
  - 全局挂载 `bodyLimit({ maxSize: 512 * 1024 })`；
  - OpenAPI 注册 `bearerAuth` 并从公开 `/api/doc` 中过滤所有 `/admin/*` 路径；
  - Admin 密码校验改为 SHA-256 恒定时间比较 `timingSafeEqual`，将 `/api/collector/trigger` 迁入统一鉴权的 `POST /api/admin/collector/trigger`；
  - 密码重置令牌 `reset_token` 改为 SHA-256 哈希存库与校验；注册/登录/忘记密码/重置密码/联系消息接入按 IP 限流（复用现有 D1 `cli_auth_limits` 表）；登录与注册更新 `last_login`；
  - Google 与 GitHub OAuth 显式校验 `tokens.access_token` 以及邮箱已验证标记（`verified_email === true` / `email.verified === true`）。
- **业务逻辑与账单缺陷修复**：
  - `PUT /api/users/profile` 使用 `safeParse` 返回 400 而非 500；`DELETE /api/users/account` 容忍 Stripe 侧已取消/不存在订阅（`resource_missing`/404）；
  - `POST /api/authorized-ips` 补充 JSON 安全解析、名称长度校验、服务端 10 IP 上限与并发唯一冲突 409；
  - Stripe Checkout 使用 `c.req.valid("json")`、安全解析 `cancelUrl`、冲突返回 409、不再泄露原始 `error.message`；`GET /api/stripe/subscription` 的 `plan_id`/`plan_name` 与 `effectivePlanType` 对齐；Webhook 缺签/验签失败返 400 并记录真实 `event.id`；`findUnacknowledgedSession` 分页扫描设 500 上限；`fulfillPass` 的 `!expires` 校验移出重复兑现 `try/catch`；
  - Admin 端修复 `DELETE /admin/authorized-ips/:id` 漏写 `await`；编辑联系回复时清空 `user_read_at`；全站 6 处列表分页统一用 `parsePagination` 钳制上下限防负数全表查询；联系消息搜索改用 `INSTR` 避开 D1 `LIKE` 50 字节限制；`admin/stats.ts` 修正 `LIKE 'anon\\_%' ESCAPE '\\'` 及未知费用币种/类别防护；
  - CLI 服务端 `revoke()` 提取 `authenticateToken(token)` 严格按 RFC 7009 对非法字符令牌返 `200 OK`；CLI 工具路由 `bodyLimit` 提至 `64 KB` 以容纳 10,000 字符多字节 UTF-8 搜索词，并调整为先鉴权再解析 JSON。
- 新增专门安全与边界回归测试 `worker/api/routes/security-hardening.test.ts`（9/9 通过）。

### 3.4 架构收敛与 CI / 运维配置

- **纯共享层收口**：将 `tool-channels`、`tool-outcomes`、`admin-user`、`datetime` 迁入根目录 `shared/`，抽取 `shared/admin-stats.ts`，彻底消除 `src/ ↔ worker/` 与 `shared/ → worker/` 的 20 处跨层引用。
- **领域归位与死代码清理**：将 `billing-reconciliation.{ts,test.ts}` 与 `checkout-reconciliation.test.ts` 迁回 `worker/api/services/` 并纳入 `pnpm test`；清理 `worker/api/utils/{validation,subscription}.ts` 中的过时死函数；删除合并重复的 `worker/api/types/response.ts`；删除指向退役素材的 `ops/ui/render-og-image.mjs`。
- **细节与 CI 规范**：`request-info.ts` 改读 `OAUTH_SUBSCRIPTION_QUOTAS.hobby`；`account.ts` 去除 `/login/` 尾斜杠；`.github/workflows/ci.yml` 仅对非 `main` 分支开启 `cancel-in-progress`、统一 `.node-version` 并为公开仓库启用 npm `--provenance`（同步更新 `packages/cli/package.json`）；根 `package.json` 对齐 `engines.node >= 22.20.0` 并移除废弃 `deploy` 脚本；`.dev.vars.example` 补齐 `TELEGRAM_DEFAULT_BOT_URL`。
- **VPS PostgreSQL 配置修正**：`ops/server/pg_hba.conf` 远程访问改为强制 `hostssl`；`ops/server/postgresql.conf` 内存参数下调至匹配 3 GB 容器限额（`shared_buffers = 1GB`、`effective_cache_size = 2GB`、`maintenance_work_mem = 256MB`、`autovacuum_work_mem = 128MB`），详见第 5 节生效步骤。

### 3.5 前端缺陷修复、包体瘦身与非首页文案本土化

- **清理死代码与空载埋点**：删除 10 个未挂载/废弃文件（`Analytics.tsx`、`CookieConsent.tsx`、`lib/analytics.ts`、3 个未使用 Dashboard 组件、3 个未使用 UI 组件、`lib/animations.ts`）与死常量 `SUPPORT_URL`，移除 5 处空载 `trackEvent` 调用。
- **大幅瘦身包体**：用纯 2D `<canvas>` 点阵动效替代 Three.js/R3F（`-868 KB`）；`CodeBlock` 切 `PrismLight` 仅注册 `bash`/`json`/`toml`（`-703 KB`）；`FabButton` 用 Web Animations API 替代 GSAP（`-68 KB`）并修复暗色表面；首页 MacBook 视频改为视口 `IntersectionObserver` 懒加载（顺带修正 `F8`→`F9` 键帽错标）；资料来源卡片图片补齐 `loading="lazy" decoding="async"`。
- **交互、对比度、无障碍与状态 Bug 修复**：
  - `ModalTrigger` 保留子元素 `disabled`；`AuthorizedIPsPage` 去重报错并不再锁死提交按钮；`ForgotPasswordPage` 校验 `res.success` 后再提示成功；
  - `SubscriptionCard` 补齐 `canceled`/`trialing`/`inactive` 映射、Portal 失败提示与 `-1` 无限额本地化；
  - `dashboard` store 创建 Token 失败重新抛出异常、修正删除失败提示、统一管理 `unreadReplies` 消除双请求；`src/i18n/index.ts` 增加 `localStorage`/`navigator`/`document` 安全守卫防无痕模式或 SSR 报错；
  - 修复浅色模式下 2 处隐形文字、4 个未定义 Tailwind 类、`AdminAuth` 浅色输入框及 `TestimonialsSection` 浅色眉标对比度；
  - `RegisterForm` 统一 Google/GitHub 按钮视觉并补齐协议与隐私条款声明；`resizable-navbar` 语义化移动端菜单按钮、补全桌面/移动端登出入口并改用 `<Link>`；
  - 修复 4 处非法 `<a><button>` 嵌套与密码切换按钮 `aria-label`；`SettingsPage` 保存后重置脏状态；`plans.ts` 千分位格式化 `50,000`。
- **法务、授权与非首页文案润色**：
  - `TermsOfServiceContent` 与 `PrivacyPolicyContent` 移除破坏布局的 `prose-invert`，修正注册方式描述，如实披露 Cloudflare、SiliconFlow、DeepInfra、TypeSafe、ZenMux、Firecrawl、Stripe、Resend 等上游处理方；
  - `AuthorizePage` 补齐 `browse` 目录权限和 WWDC 字幕说明；
  - 消除 10+ 处中文界面硬编码英文（`EditableName`、`ThemeToggle`、`mcpTokenUtils`、`datetime`、`AppleSidebar`、`MCPUsageGuide`、`MCPTokensPage`、`router`、`AuthGuard`、`ResetPasswordPage`、`PricingModal`、`MCPInstallButtons` 等）；
  - 修正显性错字（如 `zh.json` `"实施"`→`"持续"`、`"苹果"`→`"Apple"`、多余空格），统一配额单位（`次调用` / `tool calls`），并将控制台、账单、设置、登录、报错、授权等全部非首页中文文案改写为自然、地道的普通话表达（**首页与 README 营销文案按要求保持不动，改进建议列于第 6 节**）。

### 3.6 CLI 客户端（`packages/cli/`）与 Agent Skill

- `packages/cli/src/cli.ts`：先解析参数再构造超时信号，修复 `apple-rag --device auth login` 超时退回 45 秒的问题；阻止 `--version` 与子命令混用；更新 `--help` 补齐短参数与公开网页 `fetch` 说明；文本模式 `search` 输出补全分块范围与 `Additional matching URLs`；Zod 校验报错将 `result_count` 映射为 `--limit`；`auth logout` 根据实际清除状态区分提示。
- `packages/cli/src/client.ts` & `credentials.ts` & `login.ts`：为 `json()`、`exchange()`、`device()` 补齐非 JSON 响应（如 502 HTML）与 schema 防护；密钥链报错附带脱敏底层原因便于 Linux/WSL 排障；`clear()` 容忍已被手工删掉的 keyring 条目并确保清理本地 marker 文件；`parseToken` 指向现行设置入口 `Settings → Automation access`；回调服务不再因 `/favicon.ico` 等杂请求覆盖语言状态；移除 `credentials.refresh_token!` 非空断言。
- `src/utils/skillDoc.test.ts`：补齐 `browse` 校验与 `SKILL.md` `metadata.version === packages/cli/package.json` 版本同步校验；`packages/cli/test/cli.test.ts` 新增 3 组端到端回归测试（22/22 全部通过）。

---

## 4. 经批判性验证后刻意保留的设计

以下条目在初审时曾被标记为“疑似问题”，经逐项复核源码、历史事故与测试契约后确认**属于正确设计，刻意未改**：

1. **MCP `legacy: "stateless"`**：Cursor 等现网客户端仍走旧版 `initialize` 握手，按 [`ops/incidents/2026-10-19-cursor-mcp-protocol.md`](../incidents/2026-10-19-cursor-mcp-protocol.md) 必须长期保留。
2. **Firecrawl 无 Key 模式**：`FIRECRAWL_API_KEY` 为空时走无鉴权模式，符合 [`ops/web-retrieval.md`](../web-retrieval.md) 设计预期。
3. **每次 Embedding 异常的搜索级电报汇总**：`rag.ts` 将 `key` 设为 `null` 属于有意为之（已在 `search-model-outcome.test.ts` 中固化为契约），确保每次出现 Embedding 退化/降级都能定位对应 `request_id` 与尝试序列。
4. **缓存命中与 Apple 官方 404 的用户配额退款**：只对“实际消耗外部付费 Firecrawl 预算后目标站报错”的场景不再退用户配额；Apple 官方 404 或负缓存命中仍保留退款，避免误伤正常用户。
5. **SQLite `pass_requires_free_slot` 触发器**：数据库层已由 `migrations/0016_account_integrity.sql` 保证活跃订阅不可叠加一次性通行证，`stripe-entitlements.ts` 仅将 `!expires` 校验移出 `try/catch` 做防御性配合。
6. **Admin 401 零 DB 访问不变量**：`admin-stats.test.ts` 明确断言未通过管理密码校验时绝不触碰 D1，因此管理鉴权保持纯内存恒定时间校验。
7. **`CLI_SCOPE` 保持 `"documents:search documents:fetch"`**：该字面量已硬编码在已发布的 `apple-rag-cli@2.1.3` 中，更改将破坏现网用户刷新与授权；保留兼容并只在授权页 UI 如实向用户展示 `browse` 权限。
8. **CLI `--json` 模式下 `stderr` 保留账号配额摘要**：这是 `SKILL.md` 与 `cli.test.ts` 共同约定的双流契约（`stdout` 给结构化数据，`stderr` 给额度与引导提示）。
9. **`ArrowButton` 保持原生 `<a href>` 与 `UsagePage` 三标签预加载**：前者保证无 Router 上下文静态渲染测试稳定，后者保证三标签角标数量即时可见。
10. **首页视觉与交互骨架**：保留自定义彩色 Hero、Vibe Coders 徽章、彩虹 GitHub Star 按钮、滚动 MacBook、贴纸、好评轮播、两个直接复制提示词按钮及宽容器客户端徽标栏。

---

## 5. 需在 VPS 手工生效的 PostgreSQL 配置步骤

本次已修正仓库中的 [`ops/server/pg_hba.conf`](../server/pg_hba.conf)（远程强制 `hostssl`）与 [`ops/server/postgresql.conf`](../server/postgresql.conf)（适配 3 GB 容器的内存参数），推送 `main` 不会自动改写 VPS 上的配置文件。请在维护窗口登录 VPS（`ssh apple-rag`）按以下顺序生效：

1. **先确认当前 PostgreSQL 容器已启用 SSL 且 Worker 环境变量 `POSTGRES_SSL_MODE` 未设为 `disable`**：
   ```bash
   docker exec postgres_db psql -U apple_rag_local_admin -d apple_rag -c "SHOW ssl; SHOW shared_buffers; SELECT name, setting, source FROM pg_settings WHERE sourcefile LIKE '%postgresql.auto.conf%';"
   ```
   > 注意：如果 `postgresql.auto.conf`（由早期 `ALTER SYSTEM` 写入）里存在旧的 `shared_buffers` / `effective_cache_size` / `maintenance_work_mem` 覆盖项，需先执行 `ALTER SYSTEM RESET ...;` 否则会覆盖 `postgresql.conf`。
2. **同步新配置并先热重载 `pg_hba.conf`**：
   - 将仓库最新的 `ops/server/pg_hba.conf` 与 `ops/server/postgresql.conf` 同步到 VPS 对应挂载路径（先备份原文件）。
   - 执行 `SELECT pg_reload_conf();` 使 `hostssl` 生效，并用线上一次真实 MCP `search` 验证连接正常。
3. **重启 PostgreSQL 容器使 `shared_buffers = 1GB` 生效**（约 2–5 秒短断连，Worker 内置瞬时重试）：
   ```bash
   docker compose restart postgres_db
   docker exec postgres_db psql -U apple_rag_local_admin -d apple_rag -c "SHOW shared_buffers; SHOW effective_cache_size; SHOW maintenance_work_mem;"
   ```
4. **后续加固建议**：在确保 Cloudflare Worker 出口可达前提下，评估通过 Cloudflare Tunnel 或 Hyperdrive 收窄公网 `5432` 端口暴露，并配置异地加密备份。

---

## 6. README 与官网首页文案优化建议（待审阅，尚未修改）

按要求，本次未修改 [`README.md`](../../README.md)、[`README.zh-CN.md`](../../README.zh-CN.md) 及官网首页（`src/i18n/zh.json` / `en.json` 首页区块）的营销文案。以下是逐段审阅后的具体优化建议，供所有者拍板后择机落地：

### 6.1 `README.zh-CN.md` 与 `README.md` 建议清单

| 位置 | 现状问题 | 建议改法（去翻译腔 / 去 AI 味 / 补准确性） |
| --- | --- | --- |
| `README.zh-CN.md:9-11` | “面向智能体的 Apple 开发知识服务。” + “通过 MCP 或 CLI，让智能体查阅 Apple 开发文档和 WWDC26 字幕。”偏平淡且略带说明书口吻。 | 副标题改为更直接的一句话痛点切入，例如：**“别让 AI 再瞎编 Apple API 了。”** 下接一行说明：*“通过 MCP 或 CLI，直接给你的 Coding Agent 接上最新的 Apple 官方文档和 WWDC26 字幕。混合检索召回，Jev / Microsoft Decision 相关性排序。”* |
| `README.zh-CN.md:75` | “仪表盘也保留了手动配置示例。”与全站统一的“控制台”术语不一致。 | 改为 **“控制台”**。 |
| `README.zh-CN.md:99-142` | `## 🌟 为智能体提供开发资料`（6 宫格）与 `## 🎯 功能特性`（10 条列表）高度重复，且密集 Emoji + 破折号是典型 AI 生成 README 风格。 | 合并为一个精简的 **“核心能力与边界”** 小节（4–5 条干货），砍掉重复的 10 条清单和多余 Emoji，补上真实搜索/目录/读取的简短示例输出，让开发者 10 秒看懂效果。 |
| `README.md:141` & `README.zh-CN.md:140` | `"Your queries stay private"` / `"你的查询保持私密"` 表述过于绝对，与隐私政策中“查询词会发往第三方向量/重排模型、URL 可能发往 Firecrawl”存在张力。 | 改为如实、可信的表述：**“不读取本地代码库：服务端只接收你的查询词或目标 URL，不上传项目源码。”** / **“No source code leaves your machine — only your query or target URL is sent for retrieval.”** |
| `README.md:146` & `README.zh-CN.md:145` | “CLI 客户端以 MIT 协议分发，应用源码公开。”这是早年仓库私有时的过渡措辞；当前仓库根目录已有 MIT `LICENSE` 且全仓公开。 | 如全仓按根 `LICENSE`（MIT）开源，统一写清开源许可范围；若服务端与 CLI 有意区分许可，明确写清边界避免社区误解。 |
| `README.zh-CN.md:33-37` | 单独占一大节讲 Jev，篇幅略重于“接入后能解决什么实际问题”。 | 保留 Jev 官方标识与链接（遵循既有约定与测试），但将段落收紧为 2–3 句并补充可感知的效果对比（如“区分 iOS 17 与 iOS 26 API 变更，过滤无关旧文档”）。 |

### 6.2 官网首页文案建议（`src/i18n/zh.json` & `en.json`）

> 落地时须保留 [`AGENTS.md`](../../AGENTS.md) 约定的 Hero/MacBook/彩虹 Star 按钮/双复制按钮/横向客户端栏布局，以及 `jevMarketing.test.ts` 与 `homepageSections.test.ts` 的关键断言。

| 区块 | 当前中文文案 | 问题诊断 | 建议修改方向 |
| --- | --- | --- | --- |
| `hero.title_*` | “将 Apple 开发者文档 通过 MCP / CLI 注入智能体” | “注入智能体”偏直译英文 `"Inject ... into AI Agents"`，母语开发者读起来略拗口。 | 改为更地道的动宾搭配，例如：**“把 Apple 官方文档，通过 MCP / CLI 直接接进你的智能体”**（英文可保留 punchy 的 `Inject Apple Expertise into AI Agents via MCP / CLI`）。 |
| `hero.subtitle_desc` | “，源自 Apple 基因。RAG + Jev 为你的智能体注入 WWDC26、iOS 27 与官方文档洞见。” | “官方文档洞见”是典型英文 `insights` 直译，AI 味较重；且“注入”与主标题重复。 | 改为：**“，生于 Apple 生态。RAG + Jev 把 WWDC26、iOS 27 和官方文档，第一时间送到你的智能体手边。”** |
| `features.*` | 眉标“和智能体天生一对”，正文多处“智能体可以……智能体可以……”句式重复。 | 像功能清单翻译，缺少具体开发场景画面感。 | 眉标改为 **“专为写 Apple 代码的智能体打磨”**；每条卡片改为“场景动作 + 结果”，例如把 `document_lookup_desc` 改为 **“搜官方文档和 WWDC 字幕，顺着 SwiftUI / UIKit 官方目录找 API，需要细节再按需拉全文，不白占上下文。”** |
| `datasources.*` | “为智能体准备的 Apple 官方资料” / “每份资料，都有来源” | 偏书面、平铺直叙。 | 改为 **“官方文档 + WWDC，一份不落”** / **“每条回答都有出处可查”**，正文点明“附带原始官方文档链接，明确标出官方与站外网页来源”。 |
| `pricing.shared_quota` | “不同调用渠道、不同工具调用均共享账号额度。” | “调用渠道、工具调用”在一句话里重复两个“调用”。 | 改为 **“MCP、CLI 以及搜索/浏览/读取三项工具，统一共享账号额度。”** |
| `testimonials.*` | 5 条评价均为早期“这个 MCP 太香了 / 彻底改变了局面”风格，且全部只提 MCP 未提 CLI，AI 生成感明显。 | 与“真实可信、去 AI 味”的推广目标冲突，容易劝退资深 iOS 开发者。 | **最推荐**：替换为真实社区用户/内测开发者的具体评价（保留真实细节，如具体解决过的 SwiftUI/SwiftData/WWDC 新 API 问题，并涵盖 MCP + CLI）；在拿到新真实反馈前，可先将语气从夸张赞美收回到克制、真实的开发者口吻。 |
| `public/llms.txt` & 站内 Jev 说明 | 仅提 `Jev`，未像 README 那样说明中国大陆默认由 ZenMux 上的 Microsoft Decision 1.1 按同标准排序。 | 国内外实际路由策略一致对外透明会更专业。 | 在 `public/llms.txt` 与 `/connect` FAQ 中补一句简洁说明（需同步核对 `jevMarketing.test.ts`）。 |

---

## 7. 中长期演进观察清单

以下项目属于结构性演进或低频运营优化，记录在案供后续版本排期，避免在单次补丁中引入高风险迁移：

1. **D1 集中维护迁移（`0020`）**：补充 `UNIQUE(LOWER(email))` 表达式索引消除登录全表扫描；补齐高频查询复合索引；为 `browse_logs` 补齐 `outcome` `CHECK` 约束与 `created_at` 默认值；清理已废弃的 `users.oauth_provider`/`oauth_id`/`stripe_customer_id` 与旧限流索引；建立日志与 `model_usage_events` 的滚动归档/清理策略；将 MCP 请求更新 `last_used_at` 改为按小时节流以降低 D1 写入放大。
2. **财务对账覆盖一次性 Pro Pass**：评估将一次性通行证收款纳入 `subscription_receipts` 或建立统一收款视图，使后台收入统计完整覆盖订阅与单次卡。
3. **高并发数据库扩展与权限分离**：当并发继续增长时，评估在 VPS PG 前引入 PgBouncer 或 Cloudflare Hyperdrive，并拆分线上只读/缓存角色与后台采集写入角色；补齐 `ops/server/` 基线 `pages`/`chunks` 建表 DDL 以便从零一键重建。
4. **MCP OAuth 2.1 评估**：若未来计划接入强制要求 MCP OAuth 2.1 的纯云端客户端（如 Claude.ai Connectors、ChatGPT MCP），再规划 `/.well-known/oauth-protected-resource` 与动态注册/授权流程。
