import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

Object.defineProperty(globalThis, "localStorage", {
	configurable: true,
	value: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
});
const { Button } = await import("../components/ui/Button");
const { Input } = await import("../components/ui/Input");

test("button preserves a single slotted link child and keeps its label while loading", () => {
	const link = renderToStaticMarkup(
		createElement(
			Button,
			{ asChild: true },
			createElement("a", { href: "/settings" }, "Manage access"),
		),
	);
	assert.match(link, /<a /);
	assert.match(link, /Manage access/);
	const loading = renderToStaticMarkup(createElement(Button, { loading: true }, "Connect CLI"));
	assert.match(loading, /disabled/);
	assert.match(loading, /aria-busy="true"/);
	assert.match(loading, /Connect CLI/);
});
test("input renders its label, error and described-by association", () => {
	const html = renderToStaticMarkup(
		createElement(Input, { id: "key-name", label: "Key name", error: "Required" }),
	);
	assert.match(html, /for="key-name"/);
	assert.match(html, /aria-invalid="true"/);
	assert.match(html, /aria-describedby="key-name-hint"/);
	assert.match(html, /role="alert"/);
});
