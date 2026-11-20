import { z } from "zod";
import { TOOL_CHANNELS } from "../worker/shared/tool-channels.js";
import { MCP_CLIENT_NAMES, type MCPClientId } from "./mcp-clients.js";

export const CLIENT_PRODUCTS = {
	...MCP_CLIENT_NAMES,
	apple_cli: "Apple RAG CLI",
} as const;
export const clientFamily = z.enum([
	...(Object.keys(MCP_CLIENT_NAMES) as MCPClientId[]),
	"apple_cli",
	"probe",
	"http",
	"unrecognized",
	"missing",
]);
export const clientPeriod = z.enum(["24h", "7d", "30d", "all"]);
export const clientDimension = z.enum(["environment", "version"]);
export const CLIENT_PAGE_SIZE = 20;
const counts = z.object({
	calls: z.number(),
	accounts: z.number(),
	account_calls: z.number(),
	search: z.number(),
	browse: z.number(),
	fetch: z.number(),
	ok: z.number(),
	limited: z.number(),
});
export const clientRow = counts.extend({
	channel: z.enum(TOOL_CHANNELS).nullable(),
	family: clientFamily.nullable(),
});
export const clientReport = z.object({
	start: z.string().nullable(),
	end: z.string(),
	rows: z.array(clientRow),
});
export const clientDetails = z.object({
	total: z.number(),
	rows: z.array(
		z.object({ label: z.string().nullable(), version: z.string().nullable(), calls: z.number() }),
	),
});
export type ClientRow = z.infer<typeof clientRow>;
export type ClientPeriod = z.infer<typeof clientPeriod>;
export type ClientDimension = z.infer<typeof clientDimension>;
export type ClientReport = z.infer<typeof clientReport>;
export type ClientDetails = z.infer<typeof clientDetails>;
