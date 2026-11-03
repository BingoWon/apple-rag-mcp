// Test-only OS vault replacement for isolated child processes; never packaged.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { join } from "node:path";
export class AsyncEntry {
	constructor(_service, account) {
		this.path = join(process.env.APPLE_RAG_TEST_VAULT, account);
	}
	async getPassword() {
		try {
			return await readFile(this.path, "utf8");
		} catch (e) {
			if (e.code === "ENOENT") return null;
			throw e;
		}
	}
	async setPassword(value) {
		await mkdir(process.env.APPLE_RAG_TEST_VAULT, { recursive: true, mode: 0o700 });
		await writeFile(this.path, value, { mode: 0o600 });
	}
	async deleteCredential() {
		await rm(this.path, { force: true });
		return true;
	}
}
registerHooks({
	resolve(specifier, context, next) {
		if (specifier === "@napi-rs/keyring") return { url: import.meta.url, shortCircuit: true };
		return next(specifier, context);
	},
});
