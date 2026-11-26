import { appendFile, readFile } from "node:fs/promises";

const { name, version } = JSON.parse(
	await readFile(new URL("../../packages/cli/package.json", import.meta.url), "utf8"),
);
const registry = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
const lookup = async (url) => {
	const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
	if (response.status !== 200 && response.status !== 404)
		throw new Error(`npm registry returned HTTP ${response.status}`);
	return response.status === 200;
};
let publish = false;
let message;
if (await lookup(`${registry}/${version}`))
	message = `${name}@${version} already exists; no publication needed.`;
else if (await lookup(registry)) {
	publish = true;
	message = `Publish ${name}@${version} using the npm Trusted Publisher.`;
} else
	message = `${name} is not registered yet. Publish the package and configure npm Trusted Publishing first.`;
console.log(message);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `publish=${publish}\n`);
if (process.env.GITHUB_STEP_SUMMARY)
	await appendFile(process.env.GITHUB_STEP_SUMMARY, `### npm CLI release\n${message}\n`);
