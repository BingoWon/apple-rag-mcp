import { z } from "zod";

export const CATALOG_ROOT = "https://developer.apple.com/documentation/technologies";
export const browseInputSchema = z.strictObject({
	url: z
		.string()
		.min(1)
		.max(2048)
		.optional()
		.describe(
			"Apple documentation URL, optionally with a catalog section fragment. Omit for the root.",
		),
	page: z.int().min(1).default(1).describe("One-based page of immediate children."),
	limit: z.int().min(1).max(50).default(20).describe("Maximum immediate children on this page."),
	depth: z
		.int()
		.min(1)
		.max(3)
		.default(2)
		.describe("Maximum levels, including the first. Small branches expand automatically."),
	revision: z
		.string()
		.min(1)
		.max(128)
		.optional()
		.describe("Listing revision from the previous page. Keep the same URL and limit."),
});
export type BrowseInput = z.infer<typeof browseInputSchema>;

// Depth is bounded on the wire, including in the JSON schema advertised to MCP clients.
const item = z.object({
	href: z.string(),
	child_count: z.int().nonnegative().nullable(),
	readable: z.literal(false).optional(),
});
const branch = item.extend({ base: z.string().optional(), items: z.array(item).optional() });
export const browseDataSchema = z.object({
	base: z.string().optional(),
	items: z.array(item.extend({ base: z.string().optional(), items: z.array(branch).optional() })),
	total: z.int().nonnegative().optional(),
	revision: z.string().optional(),
});
export interface BrowseItem {
	href: string;
	child_count: number | null;
	readable?: false;
	base?: string;
	items?: BrowseItem[];
}
export interface BrowseData {
	base?: string;
	items: BrowseItem[];
	total?: number;
	revision?: string;
}
export const BROWSE_DESCRIPTION =
	"Browse indexed Apple developer documentation one level at a time, with small branches expanded automatically. Open a documentation URL or start at the root. Resolve each href against its parent, applying base first when present. Browse a section to explore it, or fetch a document to read it.";

export function formatBrowse(data: BrowseData): string {
	const lines: string[] = [];
	function list(node: { base?: string; items: BrowseItem[] }, indent: string) {
		if (node.base) lines.push(indent + "Base: " + node.base);
		for (const entry of node.items) {
			lines.push(
				indent +
					entry.href +
					" (" +
					(entry.child_count === null ? "subtopics unknown" : entry.child_count + " subtopics") +
					")" +
					(entry.readable === false ? " · browse only" : ""),
			);
			if (entry.items) list({ base: entry.base, items: entry.items }, indent + "  ");
		}
	}
	list(data, "");
	if (!data.items.length) lines.push("No indexed subtopics.");
	if (data.revision) lines.push("Total: " + data.total + " · Revision: " + data.revision);
	return lines.join("\n");
}
