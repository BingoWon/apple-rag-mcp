# 在其他项目接入 ZenMux Jev 1.14

> **2026-11-24 补充索引**：自 2026-11-22 起，Apple RAG 对中国大陆访客（`request.cf.country === "CN"`）优先经由 ZenMux 路由至 `microsoft/microsoft-decision-1.1`，非大陆请求继续优先使用 TypeSafe 官方 Jev，并将本文档描述的 ZenMux `typesafe/jev-1.14` 作为备用链。完整实证见 [`ops/incidents/2026-11-22-jev-region.md`](../incidents/2026-11-22-jev-region.md)。

在服务端读取项目所有者单独提供的 ZenMux API Key，环境变量用 `ZENMUX_API_KEY`。需要创建 Key 时，可在 ZenMux 的 Pay As You Go 控制台操作。生产部署使用项目的 Secret 管理，日志只记录请求状态和用量。 [ZenMux 快速开始](https://zenmux.ai/docs/guide/quickstart.html) · [Pay As You Go 控制台](https://zenmux.ai/platform/pay-as-you-go)

| 项目 | 值 |
| --- | --- |
| 模型 ID | `typesafe/jev-1.14` |
| 接口 | `POST https://zenmux.ai/api/v1/systemone` |
| 请求头 | `Authorization: Bearer <ZENMUX_API_KEY>`、`Content-Type: application/json` |
| 请求体 | `model`、`state`、`questions` |
| 响应 | `model`、按题目 ID 索引的 `answers`、`usage` |

Jev 使用 **System One** 协议。把要评估的材料放进 `state`，用对象在 `questions` 中按 ID 定义问题。使用 `/api/v1/decisions` 调用此模型会返回 `404 model_not_supported`。 [System One API](https://zenmux.ai/docs/api/typesafe/systemone.html) · [模型目录](https://zenmux.ai/provider/typesafe)

## 本地最小验证

预先在运行环境注入 `ZENMUX_API_KEY`，再运行下面的 Python 3 示例。它只发一次请求，在同一请求中分别给两条合成内容打分。 [System One 评分格式](https://zenmux.ai/docs/api/typesafe/systemone.html)

```python
import json
import os
from http.client import HTTPSConnection

model = "typesafe/jev-1.14"
documents = [
    {"id": "d0", "content": "NavigationStack presents a stack of SwiftUI views."},
    {"id": "d1", "content": "Core Audio supports audio units."},
]
criteria = [
    "Unrelated",
    "Related without direct evidence",
    "Directly useful in part",
    "Direct evidence for the query",
]
payload = {
    "model": model,
    "state": {"query": "SwiftUI NavigationStack", "documents": documents},
    "questions": {
        doc["id"]: {
            "type": "score",
            "instructions": f"Grade the relevance of document {doc['id']} to the query.",
            "criteria": criteria,
        }
        for doc in documents
    },
}

connection = HTTPSConnection("zenmux.ai", timeout=10)
try:
    connection.request(
        "POST",
        "/api/v1/systemone",
        body=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {os.environ['ZENMUX_API_KEY']}",
            "Content-Type": "application/json",
        },
    )
    response = connection.getresponse()
    if response.status != 200:
        raise RuntimeError(f"ZenMux returned HTTP {response.status}")
    result = json.load(response)
finally:
    connection.close()

if result.get("model") != model:
    raise RuntimeError("Unexpected model in ZenMux response")

scores = {}
for document in documents:
    name = document["id"]
    answer = result["answers"][name]
    score = answer.get("score")
    if (
        answer.get("type") != "score"
        or type(score) not in (int, float)
        or not 0 <= score <= 3
    ):
        raise RuntimeError(f"Invalid score for {name}")
    scores[name] = score

if scores["d0"] <= scores["d1"]:
    raise RuntimeError("The relevant document should rank first in this smoke test")
print(json.dumps({"model": model, "scores": scores, "usage": result.get("usage")}))
```

同一请求的实测响应为 HTTP 200、评分 `d0 = 2.93` 和 `d1 = 0`，以及 `usage.input_tokens = 459`。验收看评分范围和排序，单个分数会随输入和模型结果变化。

## 接入现有重排流程

- 已使用 TypeSafe 官方 System One 时，ZenMux 复用同一个 `state` 和 `questions`，只换 endpoint、model 和鉴权 Secret。作为备用时，等官方请求失败或评分不可用后才调用。再失败时继续用项目已有的兜底。每次尝试设独立超时，调用方取消时停止。
- 同一批候选按稳定 ID 问一组评分问题，按 ID 把 `answers` 映射回候选。用 `score` 的有限数值降序排列，范围是 `0` 到 `criteria.length - 1`。缺少某项评分时，将整批交给下一层回退，保留原始候选的映射。
- 计量使用 `usage.input_tokens`。截至 2026 年 11 月 16 日，ZenMux 对该模型标价为 **US$0.042 / 百万输入 token**，目录未列输出单价。按用量乘以当时的单价估算，请求超时且缺少用量时保留为未知，实际支出可在 ZenMux 控制台核对。 [模型定价](https://zenmux.ai/provider/typesafe) · [ZenMux 计费文档](https://zenmux.ai/docs/guide/observability/pricing.html)
