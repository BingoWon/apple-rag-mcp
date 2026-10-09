<div align="center">

<img src="https://apple-rag.com/logo-with-text.svg" alt="Apple RAG MCP" width="400">

### 你的 AI 真正需要的 Apple 文档 MCP。

*Apple 文档。WWDC26 视频字幕。RAG 检索 + [Jev](https://typesafe.ai/) 相关性排序。一个干净的工具。*

<a href="https://apple-rag.com"><img src="https://apple-rag.com/og-image-jev.png" alt="Apple RAG MCP — 由 Jev 驱动" width="800"></a>

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en/install-mcp?name=apple-rag-mcp&config=eyJ1cmwiOiJodHRwczovL21jcC5hcHBsZS1yYWcuY29tIn0%3D)

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Apple_RAG_MCP-0098FF?style=flat&logo=visualstudiocode&logoColor=ffffff)](vscode:mcp/install?%7B%22name%22%3A%22apple-rag-mcp%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.apple-rag.com%22%7D) [![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Apple_RAG_MCP-24bfa5?style=flat&logo=visualstudiocode&logoColor=ffffff)](vscode-insiders:mcp/install?%7B%22name%22%3A%22apple-rag-mcp%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.apple-rag.com%22%7D)

[🌐 官网](https://apple-rag.com) • [📊 控制台](https://apple-rag.com/overview)

[![CI](https://github.com/BingoWon/apple-rag-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/BingoWon/apple-rag-mcp/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](./README.md) | **中文**

</div>

---

## 不只是另一个文档工具

RAG 结合语义和关键词检索，找到 Apple 官方资料。[Jev](https://typesafe.ai/) 根据你的问题判断相关性，将更匹配的内容交给智能体。

**最小占用。最大信号。** 我们的 MCP 工具设计精简——没有臃肿的响应，没有浪费的 token，没有干扰你 AI agent 上下文的噪音。只有真正重要的信息。

### 由 [<img src="./public/typesafe-logo.webp" alt="" width="22" height="22"> Jev](https://typesafe.ai/) 驱动

我们已将 [Jev](https://typesafe.ai/) 决策模型接入搜索流程，用于相关性评分。
它会结合查询中的 API、平台和版本要求，为候选 Apple 文档与视频字幕评分；
我们再根据评分对结果排序，通过 MCP 交给智能体。调用失败时，备用重排序模型会自动接手。

---

## 开源透明，接入即用。

使用[托管服务](https://apple-rag.com/)，让智能体直接连接已经采集、清洗并建立索引的 Apple 开发资料库。

- **现成的资料索引：** 官方开发文档与视频字幕，通过一个连接即可检索。
- **包含检索模型调用：** 向量生成、[Jev](https://typesafe.ai/) 排序与备用模型均由服务端处理。
- **持续维护：** 内容采集、索引更新、数据库备份和协议适配由我们负责。

源码公开，可供审查与自部署。自行运行需要维护数据库、构建并更新资料索引，以及配置自己的模型 API 凭证。

[免费开始](https://apple-rag.com/)。[Pro](https://apple-rag.com/#pricing) 周付 $1，包含每周 50,000 次、每分钟 50 次工具调用，由 `search` 和 `fetch` 共用。

---

## 秒速开始

**交给智能体配置：** 在[仪表盘](https://apple-rag.com/overview)选择令牌，
点击 **复制安装提示词**，粘贴给你当前使用的智能体，由它配置连接并验证工具。

**一键安装：**

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en/install-mcp?name=apple-rag-mcp&config=eyJ1cmwiOiJodHRwczovL21jcC5hcHBsZS1yYWcuY29tIn0%3D)

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Apple_RAG_MCP-0098FF?style=flat&logo=visualstudiocode&logoColor=ffffff)](vscode:mcp/install?%7B%22name%22%3A%22apple-rag-mcp%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.apple-rag.com%22%7D) [![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Apple_RAG_MCP-24bfa5?style=flat&logo=visualstudiocode&logoColor=ffffff)](vscode-insiders:mcp/install?%7B%22name%22%3A%22apple-rag-mcp%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.apple-rag.com%22%7D)

点击按钮唤起编辑器，并在编辑器中确认安装。

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
- **协议：** `2026-07-28`
- **认证：** `可选`（MCP Token 可获得更高限额）
- **MCP Token：** 在 [apple-rag.com](https://apple-rag.com) 获取以增加配额

客户端需要支持 `2026-07-28` 协议；仅保存配置不代表已验证连接成功。

> **注意：** 无需 MCP Token 即可开始使用！你可以免费查询，无需任何认证。之后可添加 MCP Token 以获得更高的使用限额。

## 🌟 开发者为何喜爱 Apple RAG MCP

<table>
<tr>
<td width="50%">

### ⚡ **快速可靠**
通过我们优化的搜索基础设施获得快速响应。不再需要翻遍文档。

### 🎯 **AI 驱动的混合搜索**
RAG 结合语义和关键词检索，找到候选 Apple 文档与视频字幕。[Jev](https://typesafe.ai/) 根据你的问题为资料评分排序，让智能体优先获取更相关的上下文。

### 🔒 **始终安全**
MCP 认证确保你的 AI agent 获得可信的访问权限，具备企业级安全性。

</td>
<td width="50%">

### 📝 **代码示例**
获取 Swift、Objective-C 和 SwiftUI 的实用代码示例，以及文档参考。

### 🔄 **实时更新**
我们的文档索引持续跟进 WWDC26、Xcode 27 beta 以及最新 Apple 开发者资源。

### 🆓 **免费开始**
免注册体验：每周 30 次、每分钟 3 次工具调用。在 [apple-rag.com](https://apple-rag.com/) 注册后，每周 50 次、每分钟 5 次，由 `search` 和 `fetch` 共用。

</td>
</tr>
</table>

## 🎯 功能特性

- **🔍 RAG 语义搜索** - 具有语义理解能力的向量相似度检索
- **🔎 关键词搜索** - 精确的技术术语匹配，适用于 API 名称和特定术语
- **🎯 混合搜索** - 结合语义和关键词检索，由 [Jev](https://typesafe.ai/) 评分排序
- **📚 完整覆盖** - iOS 27、iPadOS 27、macOS 27、watchOS 27、tvOS 27、visionOS 27 文档
- **🎬 WWDC26 视频** - Apple 开发者视频和 WWDC26 sessions 的完整字幕
- **⚡ 快速响应** - 针对所有内容类型优化速度
- **🚀 高性能** - 多实例集群部署以实现最大吞吐量
- **🔄 始终最新** - 与 Apple 最新文档、WWDC26 sessions 和 Xcode 27 beta 参考内容同步
- **🛡️ 安全私密** - 你的查询保持私密
- **🌐 原生 MCP 2026** - 支持无状态 MCP `2026-07-28`

## 📄 开源协议

本项目基于 [MIT 协议](LICENSE) 开源。

<div align="center">

---

**更好的文档。更好的上下文。更好的代码。**

[立即开始 →](https://apple-rag.com)

</div>
