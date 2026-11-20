<div align="center">

<img src="https://apple-rag.com/logo.svg" alt="Apple RAG" width="64">

# Apple RAG

### 面向智能体的 Apple 开发知识服务。

*通过 MCP 或 CLI，让智能体查阅 Apple 开发文档和 WWDC26 字幕。RAG 负责检索，[Jev](https://typesafe.ai/) 按相关性排列结果。*

[官网](https://apple-rag.com) · 由 [<img src="./public/typesafe-logo.webp" alt="" width="18" height="18"> Jev](https://typesafe.ai/) 驱动

[![CI](https://github.com/BingoWon/apple-rag-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/BingoWon/apple-rag-mcp/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) · [English](./README.md) | **中文**

<a href="https://apple-rag.com"><img src="https://apple-rag.com/og-image.png" alt="Apple RAG — MCP / CLI 智能体接入" width="800"></a>

</div>

---

## 智能体可以做什么

| 工具 | 适用场景 |
| --- | --- |
| `search` 搜索 | 用英文查询 API 或 WWDC 中讨论过的问题，通过关键词和语义搜索找到相关原文片段。 |
| `browse` 浏览目录 | 想了解 SwiftUI 或 UIKit 的某个主题时，沿着 Apple 官方分组逐层找到 API，无需猜测文档地址。 |
| `fetch` 读取原文 | 打开搜索结果、目录中的文档或已有链接，核对完整上下文并引用来源。 |

MCP 和 CLI 都提供这三项工具。在[控制台](https://apple-rag.com/overview)可以分别查看三项工具的用量趋势、打开对应的调用记录，并查看本周剩余额度。

### 由 [<img src="./public/typesafe-logo.webp" alt="" width="22" height="22"> Jev](https://typesafe.ai/) 驱动

我们已将 [Jev](https://typesafe.ai/) 决策模型接入搜索流程，用于相关性评分。
它会结合查询中的 API、平台和版本要求，为候选 Apple 文档与视频字幕评分；
我们再根据评分对结果排序，通过 MCP 或 CLI 交给智能体。调用失败时，备用重排序模型会自动接手。

---

## 云端服务，接入即用。

使用[托管服务](https://apple-rag.com/)，让智能体直接连接已经采集、清洗并建立索引的 Apple 开发资料库。

- **现成的资料索引：** 官方开发文档与视频字幕，通过一个连接即可检索。
- **包含检索模型调用：** 向量生成、[Jev](https://typesafe.ai/) 排序与备用模型均由服务端处理。
- **持续维护：** 内容采集、索引更新、数据库备份和协议适配由我们负责。

托管服务负责数据库、资料索引更新和检索模型凭据。CLI 客户端独立分发，应用源码公开。

读取页面时，`fetch` 优先使用已收录的正文，支持跟随 Apple 的链接跳转；缺少正文时可读取官方文档 JSON 或实时提取网页。结果标明来源与读取方式，站外网页不会自动进入 Apple 搜索库。限额和日志含义见[网页读取运维说明](ops/web-retrieval.md)。

[免费开始](https://apple-rag.com/)。[Pro](https://apple-rag.com/#pricing) 周付 $1，包含每周 50,000 次、每分钟 50 次工具调用，由 `search`、`browse` 和 `fetch` 共用。

---

## 接入你的智能体

打开[接入指南](https://apple-rag.com/connect)，复制提示词，粘贴到智能体的对话框即可开始配置。

- **MCP** 适合支持原生 MCP 工具的智能体，建议优先使用。要使用账号额度，可从[控制台](https://apple-rag.com/overview)复制专属提示词。
- **CLI** 让能执行终端命令的智能体使用同样的三项工具。[npm 安装包](https://www.npmjs.com/package/apple-rag-cli)附带 CLI 和智能体技能，需要使用账号时由你在浏览器中确认授权。

### 在 Cursor 中一键接入

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en/install-mcp?name=apple-rag-mcp&config=eyJ1cmwiOiJodHRwczovL21jcC5hcHBsZS1yYWcuY29tIn0%3D)

在唤起的 [Cursor](https://cursor.com) 中确认安装。

### 其他 MCP 客户端的手动配置

**JSON 配置（复制粘贴）：**
这是配置示例，并非所有客户端通用的格式。仪表盘也保留了手动配置示例。

```json
{
  "mcpServers": {
    "apple-rag-mcp": {
      "type": "http",
      "url": "https://mcp.apple-rag.com"
    }
  }
}
```

**手动配置参数：**
- **MCP 类型：** `Streamable HTTP`
- **URL：** `https://mcp.apple-rag.com`
- **协议：** `2026-07-28`，同时兼容 `2025-11-25`、`2025-06-18`、`2025-03-26` 的 `initialize` 握手
- **认证：** `可选`（MCP Token 可获得更高限额）
- **MCP Token：** 在 [apple-rag.com](https://apple-rag.com) 获取以增加配额

仅保存配置不代表已验证连接成功。

> **注意：** 无需 MCP Token 即可开始使用！你可以免费查询，无需任何认证。之后可添加 MCP Token 以获得更高的使用限额。

## 🌟 为智能体提供开发资料

<table>
<tr>
<td width="50%">

### ⚡ **快速可靠**
通过我们优化的搜索基础设施获得快速响应。不再需要翻遍文档。

### 🎯 **AI 驱动的混合搜索**
混合搜索结合关键词与语义检索，找到候选 Apple 文档与视频字幕，再由 [Jev](https://typesafe.ai/) 对合并后的资料进行相关性重排，让智能体优先获取更相关的上下文。

### 🔒 **账号访问管理**
MCP 与 CLI 使用独立凭据，共用账号额度，可单独撤销访问。

</td>
<td width="50%">

### 📝 **可追溯的资料**
结果附带来源链接，便于智能体核对 API 细节并引用依据。

### 🔄 **持续维护**
采集器按计划检查 Apple 文档与开发者视频字幕。

### 🆓 **免费开始**
免注册体验：每周 30 次、每分钟 3 次工具调用。在 [apple-rag.com](https://apple-rag.com/) 注册后，每周 50 次、每分钟 5 次，由 `search`、`browse` 和 `fetch` 共用。

</td>
</tr>
</table>

## 🎯 功能特性

- **🔍 语义搜索** - 具有语义理解能力的向量相似度检索
- **🔎 关键词搜索** - 精确的技术术语匹配，适用于 API 名称和特定术语
- **🎯 混合搜索** - 结合关键词与语义检索
- **📚 Apple 开发资料** - 搜索已索引的文档库，实际覆盖范围取决于采集与索引情况。
- **🎬 开发者视频** - 搜索已索引的 WWDC 与 Apple 开发者视频字幕。
- **⚡ 快速响应** - 针对所有内容类型优化速度
- **🔌 MCP / CLI** - 通过原生 MCP 工具或终端命令为智能体接入。
- **🔄 定期采集** - 持续采集与索引，不保证来源更新后立即收录。
- **🛡️ 安全私密** - 你的查询保持私密
- **🌐 原生 MCP 2026** - 支持无状态 MCP `2026-07-28`，并兼容旧版 Streamable HTTP

## 📄 分发许可

CLI 客户端以 [MIT 协议](LICENSE) 分发，应用源码公开。

<div align="center">

---

**更好的文档。更好的上下文。更好的代码。**

[立即开始 →](https://apple-rag.com)

</div>
