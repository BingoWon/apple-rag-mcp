import { readFile } from "node:fs/promises";
import { setTimeout as wait } from "node:timers/promises";
import { pathToFileURL } from "node:url";

export async function waitForService(version, signal) {
	while (!signal.aborted) {
		try {
			const options = {
				signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
				cache: "no-store",
			};
			const api = await fetch("https://apple-rag.com/api", options);
			if (api.ok && (await api.json()).version === version) {
				const health = await fetch("https://apple-rag.com/api/cli/v1/health", options);
				if (health.ok && (await health.json()).channel === "cli") return;
			}
		} catch {}
		await wait(10000, undefined, { signal });
	}
	signal.throwIfAborted();
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const { version } = JSON.parse(
		await readFile(new URL("../../package.json", import.meta.url), "utf8"),
	);
	console.log(`Waiting for production service ${version} and CLI API before npm publication.`);
	await waitForService(version, AbortSignal.timeout(10 * 60000));
	console.log(`Production ${version} is ready.`);
}
