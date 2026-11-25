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

test("navigation shares one color between labels and icons and uses the brand active blue", async () => {
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
			assert.ok(html.includes(active ? "font-semibold" : "font-medium"));
			assert.ok(html.includes(active ? "bg-brand text-white font-semibold" : "text-foreground/90"));
			assert.ok(!html.includes("text-muted"));
		}
	} finally {
		if (storage) Object.defineProperty(globalThis, "localStorage", storage);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
});

test("dashboard sidebar starts with Overview and excludes public top-nav pages", async () => {
	const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: { getItem: () => "true" },
	});
	try {
		const { MemoryRouter } = await import("react-router-dom");
		const { I18nextProvider } = await import("react-i18next");
		const i18n = (await import("@/i18n")).default;
		const { ThemeProvider } = await import("@/components/providers/ThemeProvider");
		const { AppleSidebar } = await import("@/components/layout/AppleSidebar");
		await i18n.changeLanguage("en");

		const html = renderToStaticMarkup(
			createElement(
				I18nextProvider,
				{ i18n },
				createElement(
					MemoryRouter,
					{ initialEntries: ["/overview"] },
					createElement(
						ThemeProvider,
						null,
						createElement(AppleSidebar, null, createElement("div")),
					),
				),
			),
		);

		const sidebarHrefMatches = [...html.matchAll(/<a[^>]*\shref="(\/[^"]*)"/g)].map((m) => m[1]);
		// First non-logo navigation link in the sidebar must be /overview
		const navHrefs = sidebarHrefMatches.filter((href) => href !== "/");
		assert.equal(navHrefs[0], "/overview");
		assert.ok(!navHrefs.includes("/connect"));
		assert.ok(!navHrefs.includes("/updates"));
	} finally {
		if (storage) Object.defineProperty(globalThis, "localStorage", storage);
		else Reflect.deleteProperty(globalThis, "localStorage");
	}
});
