import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("desktop sidebar defaults to pinned open and respects saved choices", async () => {
	const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	try {
		Object.defineProperty(globalThis, "localStorage", {
			configurable: true,
			value: { getItem: (key: string) => (key === "apple-rag-lang" ? "en" : null) },
		});
		const { SidebarProvider, useSidebar } = await import("../components/ui/sidebar.js");
		function State() {
			const { open, pinned } = useSidebar();
			return createElement("output", { "data-open": String(open), "data-pinned": String(pinned) });
		}
		for (const [saved, expected] of [
			[null, true],
			["true", true],
			["false", false],
		] as const) {
			Object.defineProperty(globalThis, "localStorage", {
				configurable: true,
				value: { getItem: () => saved },
			});
			const html = renderToStaticMarkup(createElement(SidebarProvider, null, createElement(State)));
			assert.ok(html.includes(`data-open="${expected}"`));
			assert.ok(html.includes(`data-pinned="${expected}"`));
		}
		Object.defineProperty(globalThis, "localStorage", {
			configurable: true,
			value: {
				getItem: () => {
					throw new Error("Storage unavailable");
				},
			},
		});
		const html = renderToStaticMarkup(createElement(SidebarProvider, null, createElement(State)));
		assert.ok(html.includes('data-open="true"'));
	} finally {
		if (storage) Object.defineProperty(globalThis, "localStorage", storage);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
});

test("navigation shares one color between labels and icons and uses a deeper active blue", async () => {
	const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: { getItem: () => "true" },
	});
	try {
		const { SidebarProvider, SidebarLink } = await import("../components/ui/sidebar.js");
		for (const active of [false, true]) {
			const html = renderToStaticMarkup(
				createElement(
					SidebarProvider,
					null,
					createElement(SidebarLink, {
						link: { label: "Overview", href: "/overview/", icon: createElement("svg") },
						isActive: active,
					}),
				),
			);
			assert.equal(html.split("text-inherit").length - 1, 2);
			assert.ok(html.includes("font-medium"));
			assert.ok(html.includes(active ? "bg-brand-tertiary text-white" : "text-light/90"));
			assert.ok(!html.includes("text-muted"));
		}
	} finally {
		if (storage) Object.defineProperty(globalThis, "localStorage", storage);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
});
