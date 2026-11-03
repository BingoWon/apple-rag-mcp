import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { fixture, TOKEN } from "../../packages/cli/test/fixture.ts";

const pkgDir = fileURLToPath(new URL("../../packages/cli/", import.meta.url));
const manifest = JSON.parse(await readFile(join(pkgDir, "package.json"), "utf8"));
const destination = resolve(
	process.env.APPLE_RAG_RELEASE_DIR || join(tmpdir(), "apple-rag-cli-release"),
);
await mkdir(destination, { recursive: true });
const [packed] = JSON.parse(
	execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", destination], {
		cwd: pkgDir,
		encoding: "utf8",
	}),
);
const expected = [
	"package.json",
	"README.md",
	"LICENSE",
	"skills/apple-dev-docs/SKILL.md",
	...["cli", "client", "contracts", "credentials", "errors", "version"].map(
		(name) => `dist/${name}.js`,
	),
];
assert.deepEqual(packed.files.map((file) => file.path).sort(), expected.sort());
assert.equal(manifest.name, "apple-rag-cli");
assert.notEqual(manifest.private, true);
assert.equal(manifest.bin["apple-rag"], "dist/cli.js");
const archive = join(destination, packed.filename);
const checksum = createHash("sha256")
	.update(await readFile(archive))
	.digest("hex");
await writeFile(`${archive}.sha256`, `${checksum}  ${packed.filename}\n`);

const consumer = await mkdtemp(join(tmpdir(), "apple-rag-package-consumer-"));
const command = promisify(execFile);
let server;
try {
	await writeFile(join(consumer, "package.json"), '{"private":true,"type":"module"}\n');
	await writeFile(join(consumer, ".npmrc"), "");
	await command(
		"npm",
		[
			"install",
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
			"--package-lock=false",
			"--userconfig",
			join(consumer, ".npmrc"),
			archive,
		],
		{ cwd: consumer },
	);
	const cli = join(consumer, "node_modules", "apple-rag-cli", "dist", "cli.js");
	assert.equal(
		(await command(process.execPath, [cli, "--version"])).stdout.trim(),
		manifest.version,
	);
	assert.match(
		(await command(join(consumer, "node_modules", ".bin", "apple-rag"), ["--help"])).stdout,
		/auth login/,
	);
	server = await fixture();
	const env = {
		...process.env,
		APPLE_RAG_URL: server.endpoint,
		APPLE_RAG_CONFIG_DIR: join(consumer, "config"),
		APPLE_RAG_TOKEN: TOKEN,
	};
	const doctor = JSON.parse(
		(await command(process.execPath, [cli, "doctor", "--json"], { env })).stdout,
	);
	assert.equal(doctor.ok, true);
	assert.equal(doctor.retrieval_tested, false);
	const search = JSON.parse(
		(await command(process.execPath, [cli, "search", "SwiftUI", "--json"], { env })).stdout,
	);
	assert.equal(search.ok, true);
	assert.equal(search.account.plan, "hobby");
	assert.equal(search.account.quota.week.remaining, 49);
	assert.equal(search.results[0].complete, false);
	console.log(
		`Verified ${archive}\nSHA256 ${checksum}\n${expected.length} allowlisted files; isolated install, bin, version, discovery and MCP retrieval passed.`,
	);
} finally {
	await server?.close();
	await rm(consumer, { recursive: true, force: true });
}
