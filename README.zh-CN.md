<div align="center">

<img src="https://apple-rag.com/logo-with-text.svg" alt="Apple RAG MCP" width="400">

### 为 AI 智能体打造的 Apple 文档 MCP

*覆盖 37 万+ 文档、1,300+ 条 WWDC 视频字幕。支持语义 / 关键词 / 混合搜索，一站式把答案递到你的智能体手中。*

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en/install-mcp?name=apple-rag-mcp&config=eyJ1cmwiOiJodHRwczovL21jcC5hcHBsZS1yYWcuY29tIn0%3D)

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Apple_RAG_MCP-0098FF?style=flat&logo=visualstudiocode&logoColor=ffffff)](vscode:mcp/install?%7B%22name%22%3A%22apple-rag-mcp%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.apple-rag.com%22%7D) [![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Apple_RAG_MCP-24bfa5?style=flat&logo=visualstudiocode&logoColor=ffffff)](vscode-insiders:mcp/install?%7B%22name%22%3A%22apple-rag-mcp%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.apple-rag.com%22%7D)

[🌐 官网](https://apple-rag.com) • [📊 控制台](https://apple-rag.com/overview)

[English](./README.md) | **中文**

</div>

---

## 不只是查文档

多数工具只能做关键词匹配。Apple RAG MCP 在关键词搜索之外加入语义理解，并用 AI 混合搜索把两者结合，把真正有用的上下文精准送到你的智能体。

**精简高效。** 响应克制、不啰嗦，尽量少占用 token，不打乱智能体的上下文，只保留最有价值的信号。

---

## 方式一：秒速开始

**免费对话体验：**
- [阿里云百宝箱网页应用 - 苹果应用开发专家](https://tbox.alipay.com/inc/share/202511APsocn07628729?platform=WebService)
- [阿里云百宝箱 MCP 插件（需先登录） - 苹果开发文档检索 / Apple RAG MCP](https://tbox.alipay.com/inc/plugin-market/plugin-detail/20251130R4pz05084592)

**一键安装：**

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en/install-mcp?name=apple-rag-mcp&config=eyJ1cmwiOiJodHRwczovL21jcC5hcHBsZS1yYWcuY29tIn0%3D)

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Apple_RAG_MCP-0098FF?style=flat&logo=visualstudiocode&logoColor=ffffff)](vscode:mcp/install?%7B%22name%22%3A%22apple-rag-mcp%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.apple-rag.com%22%7D) [![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Apple_RAG_MCP-24bfa5?style=flat&logo=visualstudiocode&logoColor=ffffff)](vscode-insiders:mcp/install?%7B%22name%22%3A%22apple-rag-mcp%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fmcp.apple-rag.com%22%7D)

点击上面的按钮，在 IDE 中自动填充 MCP 配置，几秒钟即可使用。

### 方式二：为其他 MCP 客户端手动配置

**JSON 配置（直接粘贴）：**
```json
{
  "mcpServers": {
    "apple-rag-mcp": {
      "url": "https://mcp.apple-rag.com"
    }
  }
}
```

**手动配置参数：**
- **MCP 类型：** `Streamable HTTP`
- **URL：** `https://mcp.apple-rag.com`
- **认证：** `可选`（添加 MCP Token 可提升配额）
- **MCP Token：** 在 [apple-rag.com](https://apple-rag.com) 获取

**支持的客户端：** 通义灵码、Cursor、Claude Desktop、Cline，以及任何兼容 MCP 的工具。

> **提示：** 开箱即可免费使用，无需 Token。需要更高额度时，再添加 MCP Token。

## 🌟 开发者为什么选 Apple RAG MCP

<table>
<tr>
<td width="50%">

### ⚡ **响应迅捷**
优化的搜索基础设施，结果反馈更快，省去翻找文档的时间。

### 🎯 **AI 混合搜索**
语义 + 关键词 + 向量重排序，精准锁定 Apple 文档里的上下文答案。

### 🔒 **安全可信**
MCP 认证链路，确保你的智能体获得安全、可控的访问。

</td>
<td width="50%">

### 📝 **示例随取随用**
提供 Swift、Objective-C、SwiftUI 的实用代码示例和文档。

### 🔄 **持续更新**
文档索引与 Apple 开发者资源持续同步，保持最新。

### 🆓 **免费上手**
无需 Token 即可使用；可在 [apple-rag.com](https://apple-rag.com) 获取更多配额。

</td>
</tr>
</table>

## 🎯 核心能力

- **🔍 RAG 语义搜索** - 基于语义理解的向量相似度检索
- **🔎 关键词搜索** - 精准匹配 API 名称和技术术语
- **🎯 混合搜索** - 语义 + 关键词 + AI 重排序，挑出最佳结果
- **📚 全面覆盖** - 覆盖 iOS、macOS、watchOS、tvOS、visionOS 文档
- **🎬 WWDC 视频** - 收录 Apple 开发者视频与 WWDC session 字幕
- **⚡ 快速响应** - 针对所有内容类型优化查询速度
- **🚀 高性能** - 多实例集群带来高吞吐
- **🔄 始终最新** - 持续同步最新文档与视频
- **🛡️ 安全私密** - 查询保持私密与安全
- **🌐 通用 MCP** - 兼容所有支持 MCP 的客户端

<div align="center">

---

**更优质的文档，更清晰的上下文，更踏实的代码。**

[立即开始 →](https://apple-rag.com)

</div>

