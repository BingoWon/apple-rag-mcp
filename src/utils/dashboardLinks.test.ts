import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRoutesFromChildren, matchRoutes } from "react-router-dom";
import { AppRouter } from "../router.js";

const routes = createRoutesFromChildren(AppRouter().props.children.props.children);

test("dashboard entry matches the overview route, not the not-found route", () => {
	assert.equal(matchRoutes(routes, "/overview")?.at(-1)?.route.path, "/overview");
	assert.equal(matchRoutes(routes, "/mcp-tokens")?.at(-1)?.route.path, "/mcp-tokens");
	assert.equal(matchRoutes(routes, "/dashboard")?.at(-1)?.route.path, "*");
});

test("first-party page links in both READMEs match an actual frontend route", () => {
	for (const file of ["README.md", "README.zh-CN.md"]) {
		const markdown = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
		for (const [, href] of markdown.matchAll(/\]\((https:\/\/apple-rag\.com[^)\s]*)\)/g)) {
			const pathname = new URL(href).pathname;
			const match = matchRoutes(routes, pathname)?.at(-1);
			assert.ok(match, `${file}: ${href} has no route`);
			assert.notEqual(match.route.path, "*", `${file}: ${href} resolves to the 404 page`);
		}
	}
});
