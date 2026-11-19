import {
	type BrowseData,
	type BrowseInput,
	type BrowseItem,
	CATALOG_ROOT,
} from "../../shared/browse.js";

export interface CatalogChild {
	url: string;
	count: number | null;
	readable: boolean;
}
export interface CatalogPage extends CatalogChild {
	members: CatalogChild[];
	digest: string;
	directory: boolean;
}
export interface CatalogReader {
	pages(urls: string[], start: number, limit: number): Promise<CatalogPage[]>;
	sections(url: string, fragment: string): Promise<{ url: string; total: number }[]>;
	alias(url: string): Promise<string | null>;
}
type Detail = { candidates?: string[]; total?: number };
export class CatalogError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly detail: Detail = {},
	) {
		super(message);
	}
}
const bytes = (s: string) => new TextEncoder().encode(s).byteLength;
const size = (value: unknown) => bytes(JSON.stringify(value));
function parse(input: string): URL {
	let u: URL;
	try {
		u = new URL(input);
	} catch {
		throw new CatalogError(400, "INVALID_ARGUMENTS", "Use an absolute Apple documentation URL.");
	}
	if (
		u.origin !== "https://developer.apple.com" ||
		u.username ||
		u.password ||
		!/^\/documentation(?:\/|$)/i.test(u.pathname) ||
		bytes(u.href) > 2048
	)
		throw new CatalogError(
			400,
			"UNSUPPORTED_BROWSE_URL",
			"Browse covers Apple developer documentation. Use fetch to read a page.",
		);
	if (u.search)
		throw new CatalogError(
			400,
			"UNSUPPORTED_VARIANT",
			"Browse supports the default documentation view.",
		);
	return u;
}
export function relativeLink(base: string, target: string): string {
	const a = new URL(base),
		t = new URL(target);
	if (a.origin !== t.origin || t.origin !== "https://developer.apple.com")
		throw new Error("Invalid catalog origin");
	if (a.pathname === t.pathname && t.hash) return t.hash;
	const from = a.pathname.split("/").slice(1, -1),
		to = t.pathname.split("/").slice(1);
	while (from.length && to.length && from[0] === to[0]) {
		from.shift();
		to.shift();
	}
	let path = "../".repeat(from.length) + to.join("/");
	if (!path || path.split("/")[0]?.includes(":")) path = "./" + path;
	const ref = path + t.hash;
	return new URL(ref, base).href === target && bytes(ref) <= bytes(t.pathname + t.hash)
		? ref
		: t.pathname + t.hash;
}
export async function browseCatalog(
	db: CatalogReader,
	input: BrowseInput,
	signal: AbortSignal,
): Promise<BrowseData> {
	signal.throwIfAborted();
	const supplied = input.url;
	const original = parse(supplied ?? CATALOG_ROOT);
	let fragment: string;
	try {
		fragment = decodeURIComponent(original.hash.slice(1));
	} catch {
		throw new CatalogError(400, "INVALID_ARGUMENTS", "Invalid section encoding.");
	}
	const path = original.pathname.toLowerCase().replace(/\/+$/, "");
	const doc = path === "/documentation" ? CATALOG_ROOT : original.origin + path;
	const start = (input.page - 1) * input.limit;
	// Huge page numbers can never index a PostgreSQL array.
	const offset = Number.isSafeInteger(start) && start < 2147483500 ? start : 2147483500;
	let target = doc + (fragment ? "#" + encodeURIComponent(fragment) : "");
	let [node] = await db.pages([target], offset, input.limit);
	if (!node) {
		const alias = await db.alias(doc);
		const resolved = alias ?? doc;
		if (fragment) {
			const matches = await db.sections(resolved, fragment);
			if (matches.length > 1)
				throw new CatalogError(409, "AMBIGUOUS_TARGET", "Choose a more specific catalog link.", {
					total: matches[0]!.total,
					candidates: matches.map((x) => relativeLink(original.href, x.url)),
				});
			if (!matches[0])
				throw new CatalogError(
					404,
					"NOT_IN_CATALOG",
					"This section is not in the indexed catalog.",
				);
			target = matches[0].url;
		} else target = resolved;
		if (target !== doc || alias || fragment) [node] = await db.pages([target], offset, input.limit);
	}
	if (!node)
		throw target === CATALOG_ROOT
			? new CatalogError(
					503,
					"CATALOG_UNAVAILABLE",
					"The documentation catalog is temporarily unavailable.",
				)
			: new CatalogError(404, "NOT_IN_CATALOG", "This item is not in the indexed catalog.");
	if (node.count === null)
		throw new CatalogError(
			422,
			"NAVIGATION_UNAVAILABLE",
			"Navigation data is unavailable for this page. Use fetch to read it.",
		);
	const revision = Array.from(
		new Uint8Array(
			await crypto.subtle.digest(
				"SHA-256",
				new TextEncoder().encode(JSON.stringify([target, "default", input.limit, node.digest])),
			),
		).slice(0, 10),
		(x) => x.toString(16).padStart(2, "0"),
	).join("");
	if (input.revision && input.revision !== revision)
		throw new CatalogError(409, "LIST_CHANGED", "Reopen the listing with its original page size.");
	if (input.page > 1 && start >= node.count)
		throw new CatalogError(400, "PAGE_OUT_OF_RANGE", "This page is outside the current listing.", {
			total: node.count,
		});
	function render(p: CatalogPage, given?: string): BrowseData {
		const base = p.directory ? p.url.split("#")[0] + "/" : p.url;
		return {
			...(given === base
				? {}
				: { base: !given || given !== p.url ? base : relativeLink(given, base) }),
			items: p.members.map((m) => ({
				href: relativeLink(base, m.url),
				child_count: m.count,
				...(!m.readable && !m.url.includes("#") ? { readable: false as const } : {}),
			})),
		};
	}
	const result = render(node, supplied);
	if (node.count > input.limit) {
		result.total = node.count;
		result.revision = revision;
	}
	const initial = size(result);
	let used = result.items.length;
	type Pending = { url: string; item: BrowseItem; path: string[] };
	const pending = (p: CatalogPage, r: BrowseData, path: string[]): Pending[] =>
		p.members.map((m, i) => ({ url: m.url, item: r.items[i]!, path }));
	let level = pending(node, result, [node.url]);
	for (let depth = 1; depth < input.depth && used < 50; depth++) {
		signal.throwIfAborted();
		let reserved = used;
		const selected = level.filter(({ item, url, path }) => {
			const n = item.child_count;
			if (!n || n > 8 || reserved + n > 50 || path.includes(url)) return false;
			reserved += n;
			return true;
		});
		if (!selected.length) break;
		const rows = new Map(
			(await db.pages([...new Set(selected.map((x) => x.url))], 0, 8)).map((p) => [p.url, p]),
		);
		level = [];
		for (const { url, item, path } of selected) {
			const p = rows.get(url);
			if (!p || p.members.length !== item.child_count)
				throw new Error("Inconsistent catalog snapshot");
			const nested = render(p, url);
			Object.assign(item, nested);
			if (size(result) - initial > 8192) {
				delete item.items;
				delete item.base;
				continue;
			}
			used += nested.items.length;
			level.push(...pending(p, nested, [...path, url]));
		}
	}
	return result;
}
