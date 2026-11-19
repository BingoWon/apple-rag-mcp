import { z } from "zod";
import { browseDataSchema } from "./browse.js";

export const PLATFORM_URL = "https://apple-rag.com";
export const CLI_RESOURCE = "/api/cli/v1";
export const CLI_CLIENT_ID = "apple-rag-cli";
export const CLI_SCOPE = "documents:search documents:fetch";
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
export const cliTokenSchema = z
	.string()
	.regex(
		/^ar_cli_(?:a_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|k_[A-Za-z0-9_-]{43})$/,
		"Use a CLI credential; MCP Tokens are not accepted by the CLI API.",
	);
export const cliCredentialsSchema = z.object({
	access_token: cliTokenSchema,
	refresh_token: z.string().startsWith("ar_cli_r_").optional(),
	expires_at: z.iso.datetime(),
	expires_in: z.number().int().positive(),
	token_type: z.literal("Bearer"),
	scope: z.literal(CLI_SCOPE),
});
export type CLICredentials = z.infer<typeof cliCredentialsSchema>;

const quotaWindowSchema = z.object({
	limit: z.number().int().nonnegative().nullable(),
	remaining: z.number().int().nonnegative().nullable(),
	reset_at: z.iso.datetime(),
});
export const accountSchema = z.object({
	authenticated: z.boolean(),
	auth_method: z.enum(["anonymous", "token", "ip", "oauth", "api_key"]),
	email: z.string().nullable(),
	plan: z.enum(["anonymous", "hobby", "pro", "enterprise"]),
	quota: z.object({ week: quotaWindowSchema, minute: quotaWindowSchema }),
	login_url: z.url(),
	upgrade_url: z.url(),
});
export type AccountStatus = z.infer<typeof accountSchema>;

export const toolErrorSchema = z.object({
	request_id: z.string().optional(),
	ok: z.literal(false),
	outcome: z.enum(["invalid", "limited", "failed", "no_content"]),
	error: z.object({
		code: z.string(),
		message: z.string(),
		status: z.number().int(),
		retry_at: z.iso.datetime().optional(),
		candidates: z.array(z.string()).optional(),
		total: z.int().nonnegative().optional(),
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
	request_id: z.string().optional(),
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
	request_id: z.string().optional(),
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

export const browseOutputSchema = z
	.union([
		browseDataSchema.extend({
			ok: z.literal(true),
			outcome: z.literal("success"),
			request_id: z.string().optional(),
			account: accountSchema,
		}),
		toolErrorSchema,
	])
	.meta({ type: "object" });
export type BrowseOutput = z.infer<typeof browseOutputSchema>;
