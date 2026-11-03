import { chmodSync, copyFileSync, mkdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
copyFileSync(new URL("../../LICENSE", root), new URL("LICENSE", root));
mkdirSync(new URL("skills/apple-dev-docs/", root), { recursive: true });
copyFileSync(
	new URL("../../skills/apple-dev-docs/SKILL.md", root),
	new URL("skills/apple-dev-docs/SKILL.md", root),
);
chmodSync(new URL("dist/cli.js", root), 0o755);
