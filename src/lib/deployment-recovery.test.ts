import assert from "node:assert/strict";
import test from "node:test";
import {
	ChunkLoadError,
	hasDeploymentUpdate,
	importWithRecovery,
	isChunkLoadError,
	isDeploymentReloading,
	observeServerVersion,
	recoverFromStaleDeployment,
	resetDeploymentRecoveryState,
} from "./deployment-recovery";

function withBrowserGlobals(
	options: {
		entry?: string;
		storage?: Map<string, string>;
		onLine?: boolean;
		alreadyReloading?: boolean;
	},
	fn: (ctx: { reloads: () => number; storage: Map<string, string> }) => Promise<void> | void,
) {
	const storage = options.storage ?? new Map<string, string>();
	let reloads = 0;

	const prevWindow = globalThis.window;
	const prevDocument = globalThis.document;
	const prevNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

	const fakeWindow = {
		__APPLE_RAG_RELOADING__: options.alreadyReloading,
		sessionStorage: {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => {
				storage.set(key, value);
			},
		},
		location: {
			reload: () => {
				reloads++;
			},
		},
	};

	Object.defineProperty(globalThis, "window", {
		value: fakeWindow,
		configurable: true,
		writable: true,
	});
	Object.defineProperty(globalThis, "document", {
		value: {
			querySelector: () =>
				options.entry === undefined ? null : { getAttribute: () => options.entry },
		},
		configurable: true,
		writable: true,
	});
	Object.defineProperty(globalThis, "navigator", {
		value: { onLine: options.onLine ?? true },
		configurable: true,
		writable: true,
	});

	resetDeploymentRecoveryState();
	if (options.alreadyReloading) {
		fakeWindow.__APPLE_RAG_RELOADING__ = true;
	}

	const restore = () => {
		resetDeploymentRecoveryState();
		if (prevWindow === undefined) {
			delete (globalThis as Record<string, unknown>).window;
		} else {
			Object.defineProperty(globalThis, "window", {
				value: prevWindow,
				configurable: true,
				writable: true,
			});
		}
		if (prevDocument === undefined) {
			delete (globalThis as Record<string, unknown>).document;
		} else {
			Object.defineProperty(globalThis, "document", {
				value: prevDocument,
				configurable: true,
				writable: true,
			});
		}
		if (prevNavigator) {
			Object.defineProperty(globalThis, "navigator", prevNavigator);
		}
	};

	const result = fn({ reloads: () => reloads, storage });
	if (result && typeof (result as Promise<void>).finally === "function") {
		return (result as Promise<void>).finally(restore);
	}
	restore();
}

test("isChunkLoadError identifies browser dynamic-import failures without catching normal bugs", () => {
	assert.equal(
		isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /assets/a.js")),
		true,
	);
	assert.equal(isChunkLoadError(new TypeError("Importing a module script failed.")), true);
	assert.equal(
		isChunkLoadError(new TypeError("error loading dynamically imported module: /assets/a.js")),
		true,
	);
	assert.equal(isChunkLoadError(new Error("Unable to preload CSS for /assets/a.css")), true);
	assert.equal(isChunkLoadError(new ChunkLoadError("missing")), true);

	// Safari's generic Load failed only counts as a chunk error inside dynamic import recovery
	assert.equal(isChunkLoadError(new TypeError("Load failed")), false);
	assert.equal(isChunkLoadError(new TypeError("Load failed"), { fromDynamicImport: true }), true);

	// Ordinary application bugs are never misclassified
	assert.equal(isChunkLoadError(new TypeError("Cannot read properties of undefined")), false);
	assert.equal(isChunkLoadError(null), false);
});

test("importWithRecovery triggers a single reload and holds suspense pending during reload", async () => {
	await withBrowserGlobals({ entry: "/assets/index-aaa.js" }, async ({ reloads, storage }) => {
		let settled = false;
		const pending = importWithRecovery(() =>
			Promise.reject(new TypeError("Failed to fetch dynamically imported module: /assets/x.js")),
		).then(
			() => {
				settled = true;
			},
			() => {
				settled = true;
			},
		);

		await new Promise((resolve) => setTimeout(resolve, 10));
		assert.equal(reloads(), 1);
		assert.equal(isDeploymentReloading(), true);
		assert.equal(storage.get("apple-rag-asset-recovery:/assets/index-aaa.js"), "1");
		assert.equal(settled, false);
		void pending;
	});
});

test("importWithRecovery shares reloading state with index.html without double-reloading or flashing errors", async () => {
	const storage = new Map([["apple-rag-asset-recovery:/assets/index-aaa.js", "1"]]);
	await withBrowserGlobals(
		{ entry: "/assets/index-aaa.js", storage, alreadyReloading: true },
		async ({ reloads }) => {
			let rejected = false;
			void importWithRecovery(() => Promise.reject(new TypeError("Load failed"))).catch(() => {
				rejected = true;
			});
			await new Promise((resolve) => setTimeout(resolve, 10));
			assert.equal(reloads(), 0);
			assert.equal(rejected, false);
		},
	);
});

test("importWithRecovery stops looping after one reload per build and throws ChunkLoadError", async () => {
	const storage = new Map([["apple-rag-asset-recovery:/assets/index-aaa.js", "1"]]);
	await withBrowserGlobals({ entry: "/assets/index-aaa.js", storage }, async ({ reloads }) => {
		await assert.rejects(
			() => importWithRecovery(() => Promise.reject(new TypeError("Load failed"))),
			(err: unknown) => err instanceof ChunkLoadError && err.name === "ChunkLoadError",
		);
		assert.equal(reloads(), 0);
	});
});

test("offline dynamic import failures do not reload and surface ChunkLoadError immediately", async () => {
	await withBrowserGlobals(
		{ entry: "/assets/index-aaa.js", onLine: false },
		async ({ reloads }) => {
			await assert.rejects(
				() =>
					importWithRecovery(() =>
						Promise.reject(new TypeError("Failed to fetch dynamically imported module")),
					),
				ChunkLoadError,
			);
			assert.equal(reloads(), 0);
		},
	);
});

test("ordinary runtime errors inside dynamic imports rethrow untouched without reloading", async () => {
	await withBrowserGlobals({ entry: "/assets/index-aaa.js" }, async ({ reloads }) => {
		const boom = new ReferenceError("Unexpected render bug");
		await assert.rejects(() => importWithRecovery(() => Promise.reject(boom)), boom);
		assert.equal(reloads(), 0);
	});
});

test("observeServerVersion detects deployment skew passively from API headers", () => {
	resetDeploymentRecoveryState();
	assert.equal(hasDeploymentUpdate(), false);

	observeServerVersion("5.15.19", "dev");
	assert.equal(hasDeploymentUpdate(), false);

	observeServerVersion("5.15.19", "5.15.19");
	assert.equal(hasDeploymentUpdate(), false);

	observeServerVersion("5.15.20", "5.15.19");
	assert.equal(hasDeploymentUpdate(), true);

	resetDeploymentRecoveryState();
	assert.equal(hasDeploymentUpdate(), false);
});

test("recoverFromStaleDeployment returns true if reload is already active", () => {
	withBrowserGlobals({ entry: "/assets/index-bbb.js" }, ({ reloads }) => {
		assert.equal(recoverFromStaleDeployment(), true);
		assert.equal(recoverFromStaleDeployment(), true);
		assert.equal(reloads(), 1);
	});
});
