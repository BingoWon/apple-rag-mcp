import type { SearchTrace } from "./types.js";

const WINDOW_SECONDS = 600;
const PAUSE_MS = 300_000;
const probes = new Set<string>();

// Cache entries are already local to the executing data center.
export class TypeSafeRegion {
	private observed: number | undefined;
	private probing = false;

	constructor(
		private readonly cache: Cache,
		private readonly key: string,
	) {}

	static async forSearch(trace: SearchTrace | undefined): Promise<TypeSafeRegion | undefined> {
		if (!trace?.ingress || !trace.country) return;
		try {
			return new TypeSafeRegion(
				await caches.open("typesafe-region-v1"),
				`https://mcp.apple-rag.com/_region/typesafe/${trace.ingress}/${trace.country}`,
			);
		} catch {
			return;
		}
	}

	private async read(): Promise<number | undefined> {
		const response = await this.cache.match(this.key);
		if (!response) return;
		const value = Number(await response.text());
		return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
	}

	async skip(): Promise<boolean> {
		try {
			this.observed = await this.read();
			if (!this.observed) return false;
			if (this.observed > Date.now() || probes.has(this.key)) return true;
			probes.add(this.key);
			this.probing = true;
		} catch {
			// Cache availability must never decide search availability.
		}
		return false;
	}

	async finish(denied?: boolean): Promise<void> {
		try {
			if (denied) {
				const repeat = this.observed !== undefined || (await this.read()) !== undefined;
				const until = repeat ? Date.now() + PAUSE_MS : 0;
				await this.cache.put(
					this.key,
					new Response(String(until), {
						headers: { "Cache-Control": `public, max-age=${WINDOW_SECONDS}` },
					}),
				);
			} else if (denied === false && this.observed !== undefined) {
				await this.cache.delete(this.key);
			}
		} catch {
			// A missing marker costs at most another normal upstream attempt per search.
		} finally {
			if (this.probing) probes.delete(this.key);
		}
	}
}
