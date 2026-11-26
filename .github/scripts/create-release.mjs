#!/usr/bin/env node
/**
 * Idempotently create the vX.Y.Z GitHub release matching package.json on main.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const tag = `v${version}`;

try {
	execFileSync("git", ["rev-parse", tag], { stdio: "ignore" });
	console.log(`${tag} already exists.`);
	process.exit(0);
} catch {
	// Tag does not exist yet — create GitHub release.
}

const target = process.env.GITHUB_SHA || "HEAD";
execFileSync(
	"gh",
	["release", "create", tag, "--target", target, "--title", tag, "--generate-notes"],
	{
		stdio: "inherit",
	},
);
