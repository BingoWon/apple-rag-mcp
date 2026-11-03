import { z } from "zod";

export const MCP_URL = "https://mcp.apple-rag.com";
export const LOGIN_URL = "https://apple-rag.com/mcp-tokens";
export const UPGRADE_URL = "https://apple-rag.com/#pricing";

export const searchInputSchema = z.object({
	query: z
		.string()
		.min(1)
		.max(10000)
		.regex(/\S/, "Search query must contain non-whitespace characters.")
		.describe(
			"English technical query for Apple's official developer documentation and WWDC transcripts.",
		),
	result_count: z
		.number()
		.int()
		.min(1)
		.max(10)
		.default(4)
		.describe("Number of results to return (1-10)"),
});
export const fetchInputSchema = z.object({
	url: z
		.string()
		.min(1)
		.max(2048)
		.describe(
			"Public HTTP(S) page URL. Apple sources use the index or official JSON; other readable pages use live extraction.",
		),
});
export const tokenSchema = z
	.string()
	.regex(/^at_[a-f0-9]{32}$/, "Use an MCP Token from https://apple-rag.com/mcp-tokens.");

const quotaWindowSchema = z.object({
	limit: z.number().int().nonnegative().nullable(),
	remaining: z.number().int().nonnegative().nullable(),
	reset_at: z.iso.datetime(),
});
export const accountSchema = z.object({
	authenticated: z.boolean(),
	auth_method: z.enum(["anonymous", "token", "ip"]),
	email: z.string().nullable(),
	plan: z.enum(["anonymous", "hobby", "pro", "enterprise"]),
	quota: z.object({ week: quotaWindowSchema, minute: quotaWindowSchema }),
	login_url: z.url(),
	upgrade_url: z.url(),
});
export type AccountStatus = z.infer<typeof accountSchema>;

export const toolErrorSchema = z.object({
	ok: z.literal(false),
	outcome: z.enum(["invalid", "limited", "failed", "no_content"]),
	error: z.object({
		code: z.string(),
		message: z.string(),
		status: z.number().int(),
		retry_at: z.iso.datetime().optional(),
	}),
	url: z.string().optional(),
	source: z.enum(["apple", "third_party"]).optional(),
	provider: z.string().optional(),
	upstream_status: z.number().int().optional(),
	cache_hit: z.boolean().optional(),
	account: accountSchema.optional(),
});
export type ToolError = z.infer<typeof toolErrorSchema>;

export const searchSuccessSchema = z.object({
	ok: z.literal(true),
	account: accountSchema,
	outcome: z.enum(["success", "degraded", "no_content"]),
	query: z.string(),
	results: z.array(
		z.object({
			url: z.url(),
			title: z.string().nullable(),
			content: z.string(),
			source: z.literal("apple"),
			provider: z.literal("index"),
			complete: z.boolean(),
			total_chunks: z.number().int().positive(),
			chunk_indices: z.array(z.number().int().nonnegative()),
		}),
	),
	additional_urls: z.array(
		z.object({
			url: z.url(),
			title: z.string().nullable(),
			character_count: z.number().nonnegative(),
		}),
	),
	degradations: z.array(z.string()),
});
export const fetchSuccessSchema = z.object({
	account: accountSchema,
	ok: z.literal(true),
	outcome: z.enum(["success", "degraded"]),
	requested_url: z.string(),
	url: z.url(),
	title: z.string().nullable(),
	content: z.string(),
	source: z.enum(["apple", "third_party"]),
	provider: z.enum(["index", "apple_json", "apple_http", "firecrawl"]),
	upstream_status: z.number().int().nullable(),
	cache_hit: z.boolean(),
});
export const searchOutputSchema = z
	.union([searchSuccessSchema, toolErrorSchema])
	.meta({ type: "object" });
export const fetchOutputSchema = z
	.union([fetchSuccessSchema, toolErrorSchema])
	.meta({ type: "object" });
export type SearchOutput = z.infer<typeof searchOutputSchema>;
export type FetchOutput = z.infer<typeof fetchOutputSchema>;
