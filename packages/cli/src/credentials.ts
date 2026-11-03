import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	type CLICredentials,
	cliCredentialsSchema,
	cliTokenSchema,
} from "../../../shared/contracts.js";
import { CLIError } from "./errors.js";

export function parseToken(value: string): string {
	const parsed = cliTokenSchema.safeParse(value.trim());
	if (!parsed.success)
		throw new CLIError(
			"INVALID_TOKEN",
			"Use a CLI API key from Settings → CLI access. MCP Tokens are not accepted.",
			3,
		);
	return parsed.data;
}
export class CredentialStore {
	private directory: string;
	private id: string;
	private marker: string;
	constructor(
		readonly endpoint: string,
		env: NodeJS.ProcessEnv = process.env,
	) {
		this.directory =
			env.APPLE_RAG_CONFIG_DIR ||
			join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "apple-rag-cli");
		this.id = createHash("sha256").update(`${endpoint}\n${this.directory}`).digest("hex");
		this.marker = join(this.directory, `${this.id}.json`);
	}
	private async entry() {
		try {
			const { AsyncEntry } = await import("@napi-rs/keyring");
			return new AsyncEntry("apple-rag-cli", this.id, { linux: { store: "secret-service" } });
		} catch {
			throw this.unavailable();
		}
	}
	private unavailable() {
		return new CLIError(
			"CREDENTIAL_STORE_UNAVAILABLE",
			"Cannot access the OS credential store. Unlock it and retry; headless automation can use APPLE_RAG_TOKEN with a dedicated CLI API key.",
		);
	}
	async prepare(): Promise<void> {
		try {
			await (await this.entry()).getPassword();
		} catch {
			throw this.unavailable();
		}
	}
	async read(): Promise<CLICredentials | undefined> {
		try {
			const stat = await lstat(this.marker);
			if (!stat.isFile() || (process.platform !== "win32" && stat.mode & 0o077))
				throw new CLIError(
					"UNSAFE_CREDENTIAL_FILE",
					"Invalid CLI session metadata. Remove it and sign in again.",
				);
			const meta = JSON.parse(await readFile(this.marker, "utf8"));
			if (meta.endpoint !== this.endpoint) throw new Error("Endpoint mismatch");
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
			if (error instanceof CLIError) throw error;
			throw new CLIError(
				"CREDENTIAL_FILE_INVALID",
				"Cannot read CLI session metadata. Run auth login again.",
			);
		}
		let raw: string | null;
		try {
			raw = await (await this.entry()).getPassword();
		} catch {
			throw this.unavailable();
		}
		if (raw === null) return undefined;
		let decoded: unknown;
		try {
			decoded = JSON.parse(raw);
		} catch {
			decoded = null;
		}
		const value = cliCredentialsSchema.safeParse(decoded);
		if (!value.success)
			throw new CLIError(
				"CREDENTIAL_FILE_INVALID",
				"Invalid saved CLI session. Run auth login again.",
			);
		return value.data;
	}
	async save(value: CLICredentials): Promise<void> {
		await mkdir(this.directory, { recursive: true, mode: 0o700 });
		await chmod(this.directory, 0o700);
		try {
			await (await this.entry()).setPassword(JSON.stringify(cliCredentialsSchema.parse(value)));
		} catch {
			throw this.unavailable();
		}
		const temporary = join(this.directory, `.session-${randomUUID()}.tmp`);
		try {
			await writeFile(temporary, `${JSON.stringify({ endpoint: this.endpoint })}\n`, {
				mode: 0o600,
				flag: "wx",
			});
			await rename(temporary, this.marker);
		} finally {
			await rm(temporary, { force: true });
		}
	}
	async clear(): Promise<void> {
		try {
			await (await this.entry()).deleteCredential();
		} catch {
			throw this.unavailable();
		}
		await rm(this.marker, { force: true });
	}
	async locked<T>(signal: AbortSignal, action: () => Promise<T>): Promise<T> {
		await mkdir(this.directory, { recursive: true, mode: 0o700 });
		const path = join(this.directory, `${this.id}.lock`),
			deadline = Date.now() + 20000;
		for (;;) {
			signal.throwIfAborted();
			try {
				await mkdir(path, { mode: 0o700 });
				break;
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
				try {
					if (Date.now() - (await lstat(path)).mtimeMs > 120000) {
						await rm(path, { recursive: true, force: true });
						continue;
					}
				} catch {}
				if (Date.now() > deadline)
					throw new CLIError(
						"SESSION_BUSY",
						"Another command is updating the CLI session. Try again shortly.",
					);
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}
		try {
			return await action();
		} finally {
			await rm(path, { recursive: true, force: true });
		}
	}
}
