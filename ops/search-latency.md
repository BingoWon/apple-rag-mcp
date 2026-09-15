# 搜索延迟回归验证

关键词检索先执行精确匹配；没有结果时，平台标签与普通连接词不参与独立候选检索。备用检索包含主题词组合匹配，以及最多 8 个主题词的单词匹配。每路最多取 64 个候选 ID，按路数分配总计 256 条的候选额度，去重后再评分，优先保留主题词组合匹配。普通词保持查询顺序，不再假设长词更有区分度。这是有界的候选召回，不保证等同于对全库评分后的全局最优排序；调整上限前应同时验证召回质量与延迟。

MCP PostgreSQL 连接设置每条 SQL 2 秒执行超时和 500 毫秒锁等待超时。PostgreSQL 超时会真正取消执行；另一条检索分支有结果时继续返回结果。如果一条分支不可用且另一条没有结果，则报告搜索未完成，不把依赖故障记为成功的空搜索。这些是数据库阶段的时限，不是包含连接、配额和模型请求在内的端到端承诺。

实时 embedding 的请求与重试共享 5 秒预算，不会每次重试重新等待 5 秒。重排保留 8B → 4B 的顺序，每个模型最多等待 2 秒，整个重排阶段最多等待 4 秒；超时后使用现有候选顺序返回结果。后台采集使用独立的重试策略。

## 功能与取消行为

GitHub CI 自动启动 PostgreSQL 16，并设置 `TEST_DATABASE_URL` 运行数据库集成测试。测试使用会话临时表，覆盖高频平台词干扰、精确匹配、Contacts 长查询、两个模型均不可用时的关键词结果，以及 SQL 超时后同一连接继续可用。

```bash
TEST_DATABASE_URL=postgres://postgres:password@127.0.0.1:5432/postgres pnpm build
```

## 真实语料性能检查

`check-search-latency.ts` 通过真实 `DatabaseService.keywordSearch()` 串行执行九条历史查询，每条三轮。每次创建独立连接，检查相关结果以及单次关键词检索是否小于 3 秒，输出每条查询的最小值、中位数和最大值。它只读取数据库，不调用模型；耗时包括客户端到数据库的网络及建连开销。测试数据需包含相应 Apple 文档。

```bash
node --env-file=.dev.vars --import tsx ops/check-search-latency.ts
```

数据库使用私有 CA 时，通过 `NODE_EXTRA_CA_CERTS=/path/to/verified-ca.pem` 提供经可信渠道取得的证书。异地测试可用 `SEARCH_BENCHMARK_MAX_MS` 调整客户端验收阈值，但不得据此提高生产 SQL 的执行时限。线上还需单独验证 MCP 端到端调用，并结合 `Keyword retrieval`、`Semantic search completed` 和重排日志分析各阶段耗时。
