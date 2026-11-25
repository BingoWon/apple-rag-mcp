import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { ErrorBoundary, ErrorFallback } from "@/components/ErrorBoundary";
import i18n from "@/i18n";
import { ChunkLoadError } from "@/lib/deployment-recovery";

async function renderFallback(
	language: "zh" | "en",
	props: { error?: Error; scope?: "root" | "page" },
): Promise<string> {
	await i18n.changeLanguage(language);
	return renderToStaticMarkup(
		createElement(
			I18nextProvider,
			{ i18n },
			createElement(ErrorFallback, {
				...props,
				onReset: () => {},
				onReload: () => {},
			}),
		),
	);
}

test("ErrorFallback uses semantic theme tokens with zero hardcoded light-mode or dark: classes", async () => {
	const html = await renderFallback("zh", {
		error: new Error("Boom"),
		scope: "root",
	});

	assert.match(html, /bg-background/);
	assert.match(html, /bg-card/);
	assert.match(html, /border-border/);
	assert.match(html, /text-foreground/);
	assert.match(html, /text-subtle/);

	assert.doesNotMatch(html, /\bbg-gray-50\b/);
	assert.doesNotMatch(html, /\btext-gray-900\b/);
	assert.doesNotMatch(html, /\btext-gray-600\b/);
	assert.doesNotMatch(html, /\bbg-red-50\b/);
	assert.doesNotMatch(html, /\bdark:/);
	assert.doesNotMatch(html, /\bblue-600\b/);
	assert.doesNotMatch(html, /#2563eb/i);
});

test("ErrorFallback distinguishes stale-deployment chunk errors from runtime errors in zh and en", async () => {
	const zhChunk = await renderFallback("zh", {
		error: new ChunkLoadError("Failed to fetch dynamically imported module"),
		scope: "root",
	});
	assert.match(zhChunk, /页面资源已更新/);
	assert.match(zhChunk, /刷新加载新版/);
	assert.match(zhChunk, /href="\/"/);
	assert.match(zhChunk, /bg-brand\/10/);
	assert.doesNotMatch(zhChunk, />重试</);

	const enRuntime = await renderFallback("en", {
		error: new Error("Cannot render widget"),
		scope: "page",
	});
	assert.match(enRuntime, /Something went wrong/);
	assert.match(enRuntime, /Reload page/);
	assert.match(enRuntime, /Try again/);
	assert.match(enRuntime, /Back to home/);
	assert.match(enRuntime, /Cannot render widget/);
	assert.match(enRuntime, /bg-destructive\/10/);
	assert.match(enRuntime, /min-h-\[55vh\]/);
	assert.match(enRuntime, /<h2\b/);
});

test("ErrorBoundary automatically clears error state when resetKey changes", () => {
	const boundary = new ErrorBoundary({ children: null, resetKey: "/billing" });
	boundary.state = { hasError: true, error: new Error("boom") };
	let updated: { hasError: boolean; error?: Error } | undefined;
	boundary.setState = ((next: { hasError: boolean; error?: Error }) => {
		updated = next;
	}) as typeof boundary.setState;

	boundary.componentDidUpdate({ children: null, resetKey: "/overview" });
	assert.deepEqual(updated, { hasError: false, error: undefined });
});
