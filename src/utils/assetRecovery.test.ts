import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const script = html.match(/<script id="asset-recovery">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, "Recovery must run inline before the application module can fail");

function browser(
	entry = "/assets/build-a.js",
	storage = new Map<string, string>(),
	blocked = false,
) {
	const handlers = new Map<string, (event: object) => void>();
	let reloads = 0;
	let prevented = 0;
	class Script {
		type = "module";
		src = "https://apple-rag.com/assets/missing.js";
	}
	class Link {
		rel = "stylesheet";
		href = "https://apple-rag.com/assets/missing.css";
	}
	runInNewContext(script as string, {
		document: { querySelector: () => ({ getAttribute: () => entry }) },
		sessionStorage: {
			getItem: (key: string) => {
				if (blocked) throw new Error("Storage unavailable");
				return storage.get(key);
			},
			setItem: (key: string, value: string) => storage.set(key, value),
		},
		HTMLScriptElement: Script,
		HTMLLinkElement: Link,
		window: {
			addEventListener: (name: string, handler: (event: object) => void) =>
				handlers.set(name, handler),
			location: { origin: "https://apple-rag.com", reload: () => reloads++ },
		},
	});
	return {
		Script,
		Link,
		storage,
		reloads: () => reloads,
		prevented: () => prevented,
		dispatch: (name: string, target?: object) =>
			handlers.get(name)?.({ target, preventDefault: () => prevented++ }),
	};
}

test("missing entry scripts and styles recover without requiring the app to boot", () => {
	for (const kind of ["Script", "Link"] as const) {
		const page = browser();
		assert.equal(page.reloads(), 0);
		page.dispatch("error", new page[kind]());
		assert.equal(page.reloads(), 1);
		assert.equal(page.prevented(), 1);
	}
});

test("failed lazy imports refresh at most once per build, including after navigation", () => {
	const page = browser();
	page.dispatch("vite:preloadError");
	page.dispatch("vite:preloadError");
	assert.equal(page.reloads(), 1);
	const refreshed = browser("/assets/build-a.js", page.storage);
	refreshed.dispatch("vite:preloadError");
	assert.equal(refreshed.reloads(), 0);
	const nextBuild = browser("/assets/build-b.js", page.storage);
	nextBuild.dispatch("vite:preloadError");
	assert.equal(nextBuild.reloads(), 1);
	const previousBuild = browser("/assets/build-a.js", page.storage);
	previousBuild.dispatch("vite:preloadError");
	assert.equal(previousBuild.reloads(), 0);
});

test("ordinary runtime errors and third-party assets do not reload the page", () => {
	const page = browser();
	page.dispatch("error", {});
	const external = new page.Script();
	external.src = "https://example.com/assets/other.js";
	page.dispatch("error", external);
	assert.equal(page.reloads(), 0);
});

test("unavailable session storage does not cause a refresh loop", () => {
	const page = browser(undefined, undefined, true);
	page.dispatch("vite:preloadError");
	assert.equal(page.reloads(), 0);
});
