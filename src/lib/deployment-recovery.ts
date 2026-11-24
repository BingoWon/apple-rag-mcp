import { type ComponentType, type LazyExoticComponent, lazy } from "react";

export const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

const RECOVERY_KEY_PREFIX = "apple-rag-asset-recovery:";

const CHUNK_ERROR_PATTERNS = [
	/Failed to fetch dynamically imported module/i,
	/Importing a module script failed/i,
	/error loading dynamically imported module/i,
	/Unable to preload CSS/i,
	/Loading chunk [\w-]+ failed/i,
	/ChunkLoadError/i,
];

const DYNAMIC_IMPORT_NETWORK_PATTERNS = [/Load failed/i, /Failed to fetch/i, /NetworkError/i];

let reloading = false;
let pendingServerVersion: string | null = null;

export class ChunkLoadError extends Error {
	override readonly name = "ChunkLoadError";

	constructor(cause?: unknown) {
		const message =
			cause instanceof Error
				? cause.message
				: typeof cause === "string" && cause.length > 0
					? cause
					: "Failed to load application module";
		super(message, { cause });
	}
}

export function isChunkLoadError(
	error: unknown,
	options?: { fromDynamicImport?: boolean },
): boolean {
	if (!error) return false;
	const name = error instanceof Error ? error.name : "";
	if (name === "ChunkLoadError") return true;

	const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
	if (!message) return false;

	if (CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return true;
	if (
		options?.fromDynamicImport &&
		DYNAMIC_IMPORT_NETWORK_PATTERNS.some((pattern) => pattern.test(message))
	) {
		return true;
	}
	return false;
}

export function getCurrentBuildId(): string {
	if (typeof document !== "undefined") {
		const entry = document.querySelector('script[type="module"][src]')?.getAttribute("src");
		if (entry) return entry;
	}
	return APP_VERSION;
}

export function isDeploymentReloading(): boolean {
	return reloading || (typeof window !== "undefined" && Boolean(window.__APPLE_RAG_RELOADING__));
}

export function recoverFromStaleDeployment(): boolean {
	if (isDeploymentReloading()) return true;
	if (typeof window === "undefined") return false;
	if (typeof navigator !== "undefined" && navigator.onLine === false) return false;

	const storageKey = RECOVERY_KEY_PREFIX + getCurrentBuildId();
	try {
		if (window.sessionStorage.getItem(storageKey)) return false;
		window.sessionStorage.setItem(storageKey, "1");
	} catch {
		return false;
	}

	reloading = true;
	window.__APPLE_RAG_RELOADING__ = true;
	window.location.reload();
	return true;
}

export async function importWithRecovery<T>(importer: () => Promise<T>): Promise<T> {
	try {
		return await importer();
	} catch (error) {
		if (isChunkLoadError(error, { fromDynamicImport: true })) {
			if (recoverFromStaleDeployment()) {
				return new Promise<T>(() => {});
			}
			throw error instanceof ChunkLoadError ? error : new ChunkLoadError(error);
		}
		throw error;
	}
}

// biome-ignore lint/suspicious/noExplicitAny: matches React.lazy component constraint
export function lazyWithRecovery<T extends ComponentType<any>>(
	importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
	return lazy(() => importWithRecovery(importer));
}

export function observeServerVersion(
	serverVersion: unknown,
	currentVersion: string = APP_VERSION,
): void {
	if (typeof serverVersion !== "string") return;
	const normalized = serverVersion.trim();
	if (!normalized || currentVersion === "dev") return;
	if (normalized !== currentVersion) {
		pendingServerVersion = normalized;
	}
}

export function hasDeploymentUpdate(): boolean {
	return pendingServerVersion !== null;
}

export function resetDeploymentRecoveryState(): void {
	reloading = false;
	pendingServerVersion = null;
	if (typeof window !== "undefined") {
		delete window.__APPLE_RAG_RELOADING__;
	}
}
