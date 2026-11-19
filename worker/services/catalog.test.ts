import assert from "node:assert/strict";
import test from "node:test";
import { type BrowseData, browseInputSchema, CATALOG_ROOT } from "../../shared/browse.js";
import { browseCatalog, CatalogError, type CatalogReader, relativeLink } from "./catalog.js";

const base = "https://developer.apple.com/documentation/swiftui";
type Graph = Map<string, string[] | null>;
function reader(graph: Graph, aliases: Record<string, string> = {}): CatalogReader {
	return {
		pages: async (urls, start, max) =>
			urls.flatMap((url) => {
				if (!graph.has(url)) return [];
				const links = graph.get(url);
				return [
					{
						url,
						readable: !url.includes("#"),
						count: links?.length ?? null,
						digest: JSON.stringify(links),
						directory:
							!!links?.length &&
							links.every((v) => !v.includes("#") && v.startsWith(url.split("#")[0] + "/")),
						members: (links ?? []).slice(start, start + max).map((v) => ({
							url: v,
							count: graph.get(v)?.length ?? null,
							readable: !v.includes("#"),
						})),
					},
				];
			}),
		alias: async (u) => aliases[u] ?? null,
		sections: async (u, part) => {
			const matches = (graph.get(u) ?? []).filter(
				(s) =>
					s.includes("#") &&
					s.split("#")[1]?.toLowerCase().includes(encodeURIComponent(part).toLowerCase()),
			);
			return matches.slice(0, 10).map((url) => ({ url, total: matches.length }));
		},
	};
}
const call = (db: CatalogReader, input: unknown) =>
	browseCatalog(db, browseInputSchema.parse(input), new AbortController().signal);
const part = (r: BrowseData, url: string) =>
	r.items.map((i) => new URL(i.href, new URL(r.base ?? url, url)).href);
test("all pages reconstruct the same ordered membership for different limits, depths and link shapes", async () => {
	const p = base + "/view#Methods";
	const arr = Array.from(
		{ length: 137 },
		(_, i) =>
			base +
			"/view/" +
			["body-8kl5o", "modifier(_:)", "body-swift.associatedtype", "a%2fb", "%e7%95%8c"][i % 5] +
			"-" +
			i,
	);
	const g: Graph = new Map([
		[base + "/view", [p]],
		[p, arr],
		...arr.map((u): [string, string[]] => [u, []]),
	]);
	const db = reader(g);
	for (let limit = 1; limit <= 50; limit++) {
		for (const depth of [1, 2, 3]) {
			const all: string[] = [];
			let revision: string | undefined;
			for (let page = 1; all.length < arr.length; page++) {
				const r = await call(db, { url: p, page, limit, revision, depth });
				assert.equal(r.total, arr.length);
				assert.ok(r.revision);
				revision = r.revision;
				all.push(...part(r, p));
			}
			assert.deepEqual(all, arr);
		}
	}
	const rev = (await call(db, { url: p, limit: 2 })).revision;
	await assert.rejects(call(db, { url: p, page: 2, limit: 1, revision: rev }), {
		code: "LIST_CHANGED",
	});
	arr.reverse();
	await assert.rejects(call(db, { url: p, page: 2, limit: 2, revision: rev }), {
		code: "LIST_CHANGED",
	});
	await assert.rejects(call(db, { url: p, page: Number.MAX_SAFE_INTEGER }), {
		code: "PAGE_OUT_OF_RANGE",
	});
});
test("resolve canonical bases, disambiguate fragments, keep unknown separate from empty", async () => {
	const p = base + "/view",
		g: Graph = new Map([
			[CATALOG_ROOT, [p]],
			[p, [p + "#Creating-a-view", p + "#Other-views"]],
			[p + "#Creating-a-view", [base + "/viewbuilder"]],
			[p + "#Other-views", []],
			[base + "/viewbuilder", []],
			[base + "/unknown", null],
		]);
	const db = reader(g, { [base + "/old"]: p });
	for (const url of [
		p + "#creating",
		p + "/#Creating-a-view",
		p.toUpperCase().replace("HTTPS", "https") + "#creating",
		base + "/old#Creating-a-view",
	]) {
		const r = await call(db, { url });
		assert.deepEqual(part(r, url), [base + "/viewbuilder"]);
	}
	await assert.rejects(
		call(db, { url: p + "/#view" }),
		(e) =>
			e instanceof CatalogError &&
			e.code === "AMBIGUOUS_TARGET" &&
			e.detail.candidates?.every((s) => g.has(new URL(s, p + "/#view").href)) === true,
	);
	assert.equal((await call(db, {})).base, CATALOG_ROOT);
	assert.deepEqual((await call(db, { url: base + "/viewbuilder" })).items, []);
	for (const [url, code] of [
		[p + "#absent", "NOT_IN_CATALOG"],
		[base + "/unknown", "NAVIGATION_UNAVAILABLE"],
		[p + "?language=objc", "UNSUPPORTED_VARIANT"],
		["https://developer.apple.com/videos/play/wwdc2025/1", "UNSUPPORTED_BROWSE_URL"],
		["https://swift.org/documentation", "UNSUPPORTED_BROWSE_URL"],
		[p + "#%xx", "INVALID_ARGUMENTS"],
	]) {
		await assert.rejects(call(db, { url }), { code });
	}
	await assert.rejects(call(reader(new Map()), {}), { code: "CATALOG_UNAVAILABLE" });
});
test("bounded breadth-first expansion preserves parents, order and counts at every cutoff", async () => {
	for (const width of [1, 2, 3, 8, 9, 20, 49, 50, 51]) {
		const g: Graph = new Map(),
			p = base + "/catalog";
		const make = (u: string, n: number, level: number) => {
			const a = Array.from({ length: n }, (_, i) => u + "/" + i);
			g.set(u, a);
			for (const [i, v] of a.entries())
				if (level < 2) make(v, (i % 9) + 1, level + 1);
				else g.set(v, [p]);
		};
		make(p, width, 0);
		const db = reader(g);
		for (const limit of [1, 8, 20, 50])
			for (const depth of [1, 2, 3]) {
				const r = await call(db, { url: p, limit, depth });
				let count = 0;
				const walk = (node: BrowseData, u: string, lev: number) => {
					const refs = part(node, u);
					count += refs.length;
					for (const [i, v] of refs.entries()) {
						const item = node.items[i]!;
						assert.equal(item.child_count, g.get(v)?.length);
						if (item.items) {
							assert.ok(lev < depth);
							assert.ok(item.items.length <= 8);
							assert.equal(item.items.length, item.child_count);
							walk({ items: item.items, base: item.base }, v, lev + 1);
						}
					}
				};
				walk(r, p, 1);
				assert.ok(count <= 50);
				assert.equal(r.items.length, Math.min(limit, width));
			}
	}
	const p = base + "/small",
		branch = p + "#Long",
		long = Array.from({ length: 6 }, (_, i) => base + "/" + "a".repeat(1630) + i);
	const g: Graph = new Map([
		[p, [branch]],
		[branch, long],
		...long.map((u): [string, string[]] => [u, []]),
	]);
	const r = await call(reader(g), { url: p, depth: 3 });
	assert.equal(r.items[0]?.items, undefined);
	assert.equal(r.items[0]?.child_count, 6);
	g.set(branch, [p]);
	const cyc = await call(reader(g), { url: p, depth: 3 });
	assert.equal(cyc.items[0]?.items?.[0]?.items, undefined);
});
test("relative URLs round-trip across nested, sibling, fragment, encoded and trailing slash bases", () => {
	const paths = [
		"/view",
		"/view/",
		"/view#Methods",
		"/view/body",
		"/view/modifier(_:)",
		"/view/%e7%95%8c",
		"/view/x:y",
		"/viewbuilder",
	];
	for (const a of paths)
		for (const b of paths) {
			const u = base + a,
				v = base + b;
			assert.equal(new URL(relativeLink(u, v), u).href, v);
		}
	for (const input of [
		{ depth: 4 },
		{ page: 0 },
		{ limit: 51 },
		{ limit: 1.5 },
		{ revision: "" },
		{ section: "Views" },
	])
		assert.equal(browseInputSchema.safeParse(input).success, false);
});
