import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { tokenSchema } from "./contracts.js";
import { CLIError } from "./errors.js";

export function credentialFile(env: NodeJS.ProcessEnv): string {
	return join(
		env.APPLE_RAG_CONFIG_DIR ||
			join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "apple-rag"),
		"credentials.json",
	);
}

export async function loadToken(
	endpoint: string,
	env: NodeJS.ProcessEnv,
): Promise<string | undefined> {
	if (env.APPLE_RAG_TOKEN !== undefined) return parseToken(env.APPLE_RAG_TOKEN);
	const path = credentialFile(env);
	try {
		const stat = await lstat(path);
		if (!stat.isFile() || (process.platform !== "win32" && stat.mode & 0o077)) {
			throw new CLIError(
				"UNSAFE_CREDENTIAL_FILE",
				"Credentials must be a regular owner-only file. Run auth login again.",
			);
		}
		const saved = z
			.object({ endpoint: z.string(), token: tokenSchema })
			.parse(JSON.parse(await readFile(path, "utf8")));
		return saved.endpoint === endpoint ? saved.token : undefined;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		if (error instanceof CLIError) throw error;
		throw new CLIError(
			"CREDENTIAL_FILE_INVALID",
			"Cannot read saved credentials. Run auth login again, or use APPLE_RAG_TOKEN.",
		);
	}
}

export function parseToken(value: string): string {
	const parsed = tokenSchema.safeParse(value.trim());
	if (!parsed.success)
		throw new CLIError(
			"INVALID_TOKEN",
			"Use a valid MCP Token from https://apple-rag.com/mcp-tokens.",
			3,
		);
	return parsed.data;
}

export async function saveToken(
	endpoint: string,
	token: string,
	env: NodeJS.ProcessEnv,
): Promise<void> {
	const path = credentialFile(env);
	const directory = dirname(path);
	await mkdir(directory, { recursive: true, mode: 0o700 });
	await chmod(directory, 0o700);
	const temporary = join(directory, `.credentials-${randomUUID()}.tmp`);
	try {
		await writeFile(temporary, `${JSON.stringify({ endpoint, token })}\n`, {
			mode: 0o600,
			flag: "wx",
		});
		await rename(temporary, path);
	} finally {
		await rm(temporary, { force: true });
	}
}

export async function removeToken(env: NodeJS.ProcessEnv): Promise<void> {
	await rm(credentialFile(env), { force: true });
}
