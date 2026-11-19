<div align="center">

<img src="https://apple-rag.com/logo.svg" alt="Apple RAG" width="64">

# Apple RAG

### 面向智能体的 Apple 开发知识服务。

*Apple 文档。WWDC26 视频字幕。RAG 检索 + [Jev](https://typesafe.ai/) 相关性排序。支持 MCP / CLI。*

[官网](https://apple-rag.com) · 由 [<img src="./public/typesafe-logo.webp" alt="" width="18" height="18"> Jev](https://typesafe.ai/) 驱动

[![CI](https://github.com/BingoWon/apple-rag-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/BingoWon/apple-rag-mcp/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) · [English](./README.md) | **中文**

<a href="https://apple-rag.com"><img src="https://apple-rag.com/og-image.png" alt="Apple RAG — MCP / CLI 智能体接入" width="800"></a>

</div>

---

## 不只是另一个文档工具

混合检索结合关键词与语义搜索，找到 Apple 官方资料，再由 [Jev](https://typesafe.ai/) 对合并后的候选结果进行相关性重排，将更匹配的内容交给智能体。

**最小占用。最大信号。** 我们的 MCP 工具设计精简——没有臃肿的响应，没有浪费的 token，没有干扰你 AI agent 上下文的噪音。只有真正重要的信息。

### 由 [<img src="./public/typesafe-logo.webp" alt="" width="22" height="22"> Jev](https://typesafe.ai/) 驱动

我们已将 [Jev](https://typesafe.ai/) 决策模型接入搜索流程，用于相关性评分。
它会结合查询中的 API、平台和版本要求，为候选 Apple 文档与视频字幕评分；
我们再根据评分对结果排序，通过 MCP 交给智能体。调用失败时，备用重排序模型会自动接手。

---

## 云端服务，接入即用。

使用[托管服务](https://apple-rag.com/)，让智能体直接连接已经采集、清洗并建立索引的 Apple 开发资料库。

- **现成的资料索引：** 官方开发文档与视频字幕，通过一个连接即可检索。
- **包含检索模型调用：** 向量生成、[Jev](https://typesafe.ai/) 排序与备用模型均由服务端处理。
- **持续维护：** 内容采集、索引更新、数据库备份和协议适配由我们负责。

托管服务负责数据库、资料索引更新和检索模型凭据。CLI 客户端独立分发，应用源码公开。

`browse` 按官方分组浏览已收录的 SwiftUI 和 UIKit 文档。从目录根或文档 URL 进入，使用相对链接展开子项，用 `fetch` 读取正文。

`search` 检索已建立索引的 Apple 资料。`fetch` 优先读取已有正文，处理 Apple
链接跳转；缺少内容时读取官方文档 JSON，或通过 Firecrawl 提取网页正文。
响应标明内容来源和读取方式。公开网页缓存在 RAG 资料库之外，任意第三方网页不会
自动进入搜索索引。限额、配置和日志含义见[网页读取运维说明](ops/web-retrieval.md)。

[免费开始](https://apple-rag.com/)。[Pro](https://apple-rag.com/#pricing) 周付 $1，包含每周 50,000 次、每分钟 50 次工具调用，由 `search`、`browse` 和 `fetch` 共用。

---

## 秒速开始

**终端和编程智能体：** 使用 [Apple RAG CLI](packages/cli/README.md)：

```sh
npm install -g apple-rag-cli
apple-rag auth login
apple-rag search "SwiftUI NavigationStack" --limit 3 --json
```

CLI 与 MCP 共用匿名、免费和 Pro 权益及账号额度。CLI 2.x 通过网站独立授权设备，
不使用 MCP Token；设备和 API key 在设置中单独管理。`auth status` 查询实时套餐和
剩余额度，`upgrade` 提供网站订阅入口。首次 npm 发布由包所有者操作，见
[CLI 发布运维说明](ops/cli.md)。

**交给智能体配置：** 在[仪表盘](https://apple-rag.com/overview)选择令牌，
点击 **复制安装提示词**，粘贴给你当前使用的智能体，由它配置连接并验证工具。

**一键安装：**

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en/install-mcp?name=apple-rag-mcp&config=eyJ1cmwiOiJodHRwczovL21jcC5hcHBsZS1yYWcuY29tIn0%3D)

在唤起的 [Cursor](https://cursor.com) 中确认安装。

### 方式二：其他 MCP 客户端手动配置

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
