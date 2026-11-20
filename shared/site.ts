export const SITE_ORIGIN = "https://apple-rag.com";
interface SitePage {
	title: string;
	description: string;
	indexable: boolean;
	zh?: { title: string; description: string };
}
export const SITE_PAGES: Record<string, SitePage> = {
	"/": {
		title: "Apple RAG — Apple Developer Knowledge for AI Agents",
		description:
			"Connect your AI agent via MCP or CLI to search Apple docs and WWDC transcripts, browse SwiftUI and UIKit by topic, and read source pages.",
		indexable: true,
		zh: {
			title: "Apple RAG — 面向智能体的 Apple 开发知识服务",
			description:
				"通过 MCP 或 CLI，让智能体搜索 Apple 开发文档与 WWDC 字幕，按主题浏览 SwiftUI 和 UIKit，再读取所需原文。",
		},
	},
	"/connect": {
		title: "Connect Your Agent via MCP or CLI — Apple RAG",
		description:
			"Set up Apple RAG for your AI agent with MCP or CLI. Get setup prompts for your agent, learn how account access works, and choose a connection for your environment.",
		indexable: true,
		zh: {
			title: "接入智能体 · MCP / CLI — Apple RAG",
			description:
				"获取 MCP / CLI 接入提示词，根据智能体的运行环境选择接入方式，了解账号授权与共享额度。",
		},
	},
	"/privacy-policy": {
		title: "Privacy Policy — Apple RAG",
		description:
			"Learn how Apple RAG collects, uses, and protects information when you use its website, MCP tools, and CLI.",
		indexable: true,
	},
	"/terms-of-service": {
		title: "Terms of Service — Apple RAG",
		description:
			"Read the terms for Apple RAG accounts, subscriptions, and agent access through MCP and CLI.",
		indexable: true,
	},
	"/login": {
		title: "Sign In — Apple RAG",
		description: "Sign in to manage your Apple RAG account, subscription, and agent connections.",
		indexable: false,
		zh: { title: "登录 — Apple RAG", description: "登录 Apple RAG，管理账号、订阅和智能体连接。" },
	},
	"/register": {
		title: "Create an Account — Apple RAG",
		description: "Create an Apple RAG account for your agents. Your plan works across MCP and CLI.",
		indexable: false,
		zh: {
			title: "创建账号 — Apple RAG",
			description: "创建 Apple RAG 账号，通过 MCP / CLI 为智能体接入开发资料。",
		},
	},
	"/forgot-password": {
		title: "Forgot Your Password? — Apple RAG",
		description: "Request a password reset link for your Apple RAG account.",
		indexable: false,
		zh: { title: "找回密码 — Apple RAG", description: "申请 Apple RAG 账号的密码重置链接。" },
	},
	"/reset-password": {
		title: "Reset Your Password — Apple RAG",
		description: "Set a new password for your Apple RAG account.",
		indexable: false,
		zh: { title: "重置密码 — Apple RAG", description: "为你的 Apple RAG 账号设置新密码。" },
	},
	"/cli/authorize": {
		title: "Approve CLI Access — Apple RAG",
		description: "Review and approve a CLI device connection to your Apple RAG account.",
		indexable: false,
		zh: {
			title: "确认 CLI 授权 — Apple RAG",
			description: "查看并确认 CLI 设备访问你的 Apple RAG 账号。",
		},
	},
	"/overview": {
		title: "Your Workspace — Apple RAG",
		description:
			"Connect your agent, compare search, browse, and fetch activity, and check your remaining weekly allowance.",
		indexable: false,
		zh: {
			title: "控制台 — Apple RAG",
			description: "接入智能体，查看搜索、目录浏览和原文读取的用量趋势，以及本周剩余额度。",
		},
	},
	"/settings": {
		title: "Account Settings — Apple RAG",
		description: "Manage your profile, connected CLI devices, and unattended agent access.",
		indexable: false,
		zh: {
			title: "账号设置 — Apple RAG",
			description: "管理个人资料、CLI 设备和无人值守的智能体访问。",
		},
	},
	"/messages": {
		title: "Support Messages — Apple RAG",
		description: "View messages and replies from Apple RAG support.",
		indexable: false,
		zh: { title: "支持消息 — Apple RAG", description: "查看 Apple RAG 支持消息与回复。" },
	},
	"/usage": {
		title: "Agent Usage — Apple RAG",
		description: "Review search, browse, and fetch calls across MCP and CLI.",
		indexable: false,
		zh: {
			title: "使用记录 — Apple RAG",
			description: "查看 MCP 与 CLI 的搜索、目录浏览和原文读取记录。",
		},
	},
	"/mcp-tokens": {
		title: "MCP Tokens — Apple RAG",
		description: "Manage access credentials for your agents’ MCP connections.",
		indexable: false,
		zh: { title: "MCP 令牌 — Apple RAG", description: "管理智能体连接 MCP 时使用的访问凭据。" },
	},
	"/authorized-ips": {
		title: "Authorized IPs — Apple RAG",
		description: "Manage IP-based access for your agents’ MCP connections.",
		indexable: false,
		zh: { title: "授权 IP — Apple RAG", description: "管理智能体 MCP 连接的 IP 授权。" },
	},
	"/billing": {
		title: "Plans and Billing — Apple RAG",
		description: "Manage the Apple RAG plan shared by your agents across MCP and CLI.",
		indexable: false,
		zh: {
			title: "套餐与账单 — Apple RAG",
			description: "管理 MCP / CLI 共用的 Apple RAG 套餐与账单。",
		},
	},
	"/success": {
		title: "Payment Confirmation — Apple RAG",
		description: "Check the status of your Apple RAG payment.",
		indexable: false,
		zh: { title: "支付确认 — Apple RAG", description: "查看 Apple RAG 的支付结果。" },
	},
	"/admin": {
		title: "Administration — Apple RAG",
		description: "Apple RAG administration.",
		indexable: false,
		zh: { title: "后台管理 — Apple RAG", description: "Apple RAG 后台管理。" },
	},
};
const NOT_FOUND: SitePage = {
	title: "Page Not Found — Apple RAG",
	description: "This page could not be found. Visit Apple RAG to connect your AI agent.",
	indexable: false,
	zh: {
		title: "页面未找到 — Apple RAG",
		description: "此页面不存在。请前往 Apple RAG 首页，为你的智能体接入开发资料。",
	},
};
export function getSiteMetadata(pathname: string, language = "en") {
	const path = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
	const key = path.startsWith("/admin/") ? "/admin" : path;
	const page = SITE_PAGES[key] ?? NOT_FOUND;
	const locale = language.startsWith("zh") && page.zh ? "zh" : "en";
	const copy = locale === "zh" ? page.zh! : page;
	return {
		...copy,
		language: locale,
		locale: locale === "zh" ? "zh_CN" : "en_US",
		canonical: SITE_PAGES[key] ? `${SITE_ORIGIN}${key === "/" ? "" : key}` : undefined,
		robots: page.indexable ? "index, follow" : "noindex, nofollow",
		status: page === NOT_FOUND ? 404 : 200,
		structuredData: !page.indexable
			? undefined
			: path === "/"
				? {
						"@context": "https://schema.org",
						"@type": "SoftwareApplication",
						name: "Apple RAG",
						applicationCategory: "DeveloperApplication",
						operatingSystem: "Any",
						description: copy.description,
						url: SITE_ORIGIN,
						offers: [
							{ "@type": "Offer", price: "0", priceCurrency: "USD", name: "Hobby" },
							{
								"@type": "Offer",
								price: "1",
								priceCurrency: "USD",
								priceSpecification: {
									"@type": "UnitPriceSpecification",
									price: "1",
									priceCurrency: "USD",
									billingDuration: "P1W",
								},
								name: "Pro",
							},
						],
						featureList: [
							"RAG Retrieval",
							"Jev Relevance Ranking",
							"Semantic Search",
							"Keyword Search",
							"Hybrid Search",
							"SwiftUI and UIKit Topic Navigation",
							"Apple Developer Documentation",
							"WWDC Video Transcripts",
							"MCP Access",
							"CLI Access",
						],
					}
				: {
						"@context": "https://schema.org",
						"@type": "WebPage",
						name: copy.title,
						description: copy.description,
						url: `${SITE_ORIGIN}${path}`,
						inLanguage: locale,
						isPartOf: { "@type": "WebSite", name: "Apple RAG", url: SITE_ORIGIN },
					},
	};
}
export function siteStructuredJSON(value: unknown): string {
	return JSON.stringify(value).replace(/</g, "\\u003c");
}
export function siteSitemap(): string {
	const urls = Object.entries(SITE_PAGES)
		.filter(([, page]) => page.indexable)
		.map(([path]) => `<url><loc>${SITE_ORIGIN}${path === "/" ? "/" : path}</loc></url>`)
		.join("\n");
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
