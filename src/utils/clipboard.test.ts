import assert from "node:assert/strict";
import test from "node:test";
import { copyText } from "./clipboard.js";

test("writes exact plain text and code-formatted rich text", async () => {
	const originalNavigator = globalThis.navigator;
	const originalClipboardItem = globalThis.ClipboardItem;
	let written: ClipboardItem[] = [];

	class TestClipboardItem {
		constructor(readonly data: Record<string, Blob>) {}
	}

	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: {
			clipboard: {
				write: async (items: ClipboardItem[]) => {
					written = items;
				},
			},
		},
	});
	Object.defineProperty(globalThis, "ClipboardItem", {
		configurable: true,
		value: TestClipboardItem,
	});

	try {
		const value = '{"url":"https://mcp.apple-rag.com","token":"at_abc"}';
		await copyText(value);

		assert.equal(written.length, 1);
		const data = (written[0] as unknown as TestClipboardItem).data;
		assert.equal(await data["text/plain"].text(), value);
		assert.equal(
			await data["text/html"].text(),
			"<pre>{&quot;url&quot;:&quot;https://mcp.apple-rag.com&quot;,&quot;token&quot;:&quot;at_abc&quot;}</pre>",
		);
	} finally {
		Object.defineProperty(globalThis, "navigator", {
			configurable: true,
			value: originalNavigator,
		});
		Object.defineProperty(globalThis, "ClipboardItem", {
			configurable: true,
			value: originalClipboardItem,
		});
	}
});

test("falls back to writeText with the exact value", async () => {
	const originalNavigator = globalThis.navigator;
	const originalClipboardItem = globalThis.ClipboardItem;
	let written = "";

	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: {
			clipboard: {
				write: async () => {
					throw new Error("HTML clipboard unsupported");
				},
				writeText: async (value: string) => {
					written = value;
				},
			},
		},
	});
	Object.defineProperty(globalThis, "ClipboardItem", {
		configurable: true,
		value: class {},
	});

	try {
		await copyText("Bearer at_abc");
		assert.equal(written, "Bearer at_abc");
	} finally {
		Object.defineProperty(globalThis, "navigator", {
			configurable: true,
			value: originalNavigator,
		});
		Object.defineProperty(globalThis, "ClipboardItem", {
			configurable: true,
			value: originalClipboardItem,
		});
	}
});
