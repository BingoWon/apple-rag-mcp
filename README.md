<div align="center">

<img src="https://apple-rag.com/logo-with-text.svg" alt="Apple RAG MCP" width="400">

*Transform your AI agents into Apple development experts with instant access to official Swift docs, design guidelines, and platform knowledge.*

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en/install-mcp?name=apple-rag-mcp&config=eyJ1cmwiOiJodHRwczovL21jcC5hcHBsZS1yYWcuY29tIn0%3D)

[🌐 Learn More](https://apple-rag.com) • [🚀 Get Started](https://apple-rag.com/register) • [📊 Dashboard](https://apple-rag.com/overview)

</div>

## ✨ What is Apple RAG MCP?

Apple RAG MCP delivers exactly what your AI agents need: **official Swift development docs, design guidelines, comprehensive Apple platform knowledge, and Apple Developer YouTube content** including WWDC sessions, tutorials, and live events - current and complete.

A cutting-edge **Retrieval-Augmented Generation (RAG) system** combining Apple's official documentation with video content from the Apple Developer YouTube channel. Features **professional AI reranking** with Qwen3-Reranker-8B for superior search accuracy across multiple content types.

**🤖 AI-Powered Embedding & Reranking** • **⚡ Semantic Search for RAG** • **🔍 Keyword Search** • **🎯 Hybrid Search**

## 🚀 Quick Start

### Option 1: One-Click Cursor Setup (Recommended)

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en/install-mcp?name=apple-rag-mcp&config=eyJ1cmwiOiJodHRwczovL21jcC5hcHBsZS1yYWcuY29tIn0%3D)

Click the button above and Cursor will automatically configure everything for you in seconds.

### Option 2: Manual Setup for Other MCP Clients

**JSON Configuration (Copy & Paste):**
```json
{
  "mcpServers": {
    "apple-rag-mcp": {
      "url": "https://mcp.apple-rag.com"
    }
  }
}
```

**Manual Configuration Parameters:**
- **MCP Type:** `Streamable HTTP`
- **URL:** `https://mcp.apple-rag.com`
- **Authentication:** `Optional` (MCP Token for higher limits)
- **MCP Token:** Get yours at [apple-rag.com](https://apple-rag.com) for increased quota

### Option 3: Self-Hosted Deployment

Want to run your own instance? See our [Deployment Guide](DEPLOYMENT.md) for complete setup instructions.

**Quick Setup:**
```bash
# Clone and setup
git clone https://github.com/your-org/apple-rag-mcp.git
cd apple-rag-mcp
pnpm install

# Configure environment
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your configuration

# Deploy to Cloudflare Workers
pnpm setup-secrets
pnpm deploy
```

**Supported Clients:** Cursor, Claude Desktop, Cline, and all MCP-compatible tools.

> **Note:** No MCP Token required to start! You get free queries without any authentication. Add an MCP Token later for higher usage limits.

## 🌟 Why Developers Love Apple RAG MCP

<table>
<tr>
<td width="50%">

### ⚡ **Fast & Reliable**
Get quick responses with our optimized search infrastructure. No more hunting through docs.

### 🎯 **AI-Powered Hybrid Search**
Advanced search technology combining Semantic Search for RAG, Keyword Search, and Hybrid Search with vector similarity and technical term matching provides accurate, contextual answers from Apple's documentation.

### 🔒 **Always Secure**
MCP authentication ensures trusted access for your AI agents with enterprise-grade security.

</td>
<td width="50%">

### 📝 **Code Examples**
Get practical code examples in Swift, Objective-C, and SwiftUI alongside documentation references.

### 🔄 **Real-time Updates**
Our documentation index is continuously updated to reflect the latest Apple developer resources.

### 🆓 **Completely Free**
Start immediately with no MCP Token required. Get an MCP Token for higher usage limits - all managed at [apple-rag.com](https://apple-rag.com).

</td>
</tr>
</table>

## 🎯 Features

- **🔍 Semantic Search for RAG** - Vector similarity with semantic understanding for intelligent retrieval
- **🔎 Keyword Search** - Precise technical term matching for API names and specific terminology
- **🎯 Hybrid Search** - Combined semantic and keyword search with AI reranking for optimal results
- **📚 Complete Coverage** - iOS, macOS, watchOS, tvOS, visionOS documentation
- **📺 Video Content** - Apple Developer YouTube channel with WWDC sessions and tutorials
- **⚡ Fast Response** - Optimized for speed across all content types
- **🚀 High Performance** - Multi-instance cluster deployment for maximum throughput
- **🔄 Always Current** - Synced with Apple's latest docs and video content
- **🛡️ Secure & Private** - Your queries stay private
- **🌐 Universal MCP** - Works with any MCP-compatible client

## 🤝 Community & Support

- **🌐 Dashboard:** [apple-rag.com](https://apple-rag.com)
- **📖 Documentation:** Complete setup guides and examples
- **💬 Support:** Get help through our web dashboard
- **⭐ GitHub:** Star this repo if you find it useful!

<div align="center">

**Ready to supercharge your AI agents with Apple expertise?**

[🚀 Get Started Now](https://apple-rag.com) • [⭐ Star on GitHub](https://github.com/BingoWon/apple-rag-mcp)

*Made with ❤️ for the Apple developer community*

</div># Test
