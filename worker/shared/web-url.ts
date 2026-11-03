import { readText } from "./read-text.js";

const APPLE_HOSTS = new Set([
	"developer.apple.com",
	"support.apple.com",
	"www.apple.com",
	"apple.com",
]);

export function isAppleUrl(url: string): boolean {
	return APPLE_HOSTS.has(new URL(url).hostname);
}

export function publicUrl(input: string): string {
	const url = new URL(input.trim());
	url.hostname = url.hostname.replace(/\.$/, "");
	if (
		input.length > 2048 ||
		!["http:", "https:"].includes(url.protocol) ||
		url.username ||
		url.password ||
		url.port ||
		!url.hostname.includes(".") ||
		!url.hostname
			.split(".")
			.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) ||
		/^[\d.]+$/.test(url.hostname) ||
		url.hostname.includes(":") ||
		/(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|example|arpa)$/.test(url.hostname)
	)
		throw new Error("Use a public HTTP(S) URL without credentials or a custom port.");
	url.hash = "";
	if (APPLE_HOSTS.has(url.hostname)) {
		url.protocol = "https:";
		if (
			url.hostname === "developer.apple.com" &&
			/^\/(?:documentation|videos\/play)(?:\/|$)/i.test(url.pathname)
		) {
			url.pathname = url.pathname.replace(/\/+$/, "").toLowerCase() || "/";
		}
	}
	return url.toString();
}

export function canCacheUrl(url: string): boolean {
	// Query strings can contain signed links or private identifiers; keep them out of shared caches.
	return !new URL(url).search;
}

export function isPublicAddress(address: string): boolean {
	if (address.includes(":")) {
		try {
			new URL(`https://[${address}]/`);
		} catch {
			return false;
		}
		const [first, second] = address.split(":").map((part) => parseInt(part || "0", 16));
		return (
			first >= 0x2000 &&
			first <= 0x3fff &&
			first !== 0x2002 &&
			first !== 0x3fff &&
			!(first === 0x2001 && (second <= 0x01ff || second === 0x0db8))
		);
	}
	const parts = address.split(".").map(Number);
	if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
		return false;
	const [a, b, c] = parts;
	return !(
		a === 0 ||
		a === 10 ||
		a === 127 ||
		a >= 224 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
		(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
		(a === 203 && b === 0 && c === 113)
	);
}

export async function assertPublicHost(url: string, signal: AbortSignal): Promise<void> {
	const host = new URL(publicUrl(url)).hostname;
	const answers = await Promise.all(
		["A", "AAAA"].map(async (type) => {
			const response = await fetch(
				`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
				{
					headers: { Accept: "application/dns-json" },
					signal,
					redirect: "manual",
				},
			);
			if (!response.ok) throw new Error("Could not validate the public destination.");
			const data = JSON.parse(await readText(response, 16_384)) as {
				Answer?: { type: number; data: string }[];
			};
			return (data.Answer ?? [])
				.filter((answer) => answer.type === 1 || answer.type === 28)
				.map((answer) => answer.data);
		}),
	);
	const addresses = answers.flat();
	if (!addresses.length || !addresses.every(isPublicAddress))
		throw new Error("The destination is not a public website.");
}
