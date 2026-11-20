import { z } from "zod";

export function canonicalIP(input: unknown): string | null {
	if (typeof input !== "string") return null;
	const value = input.trim();
	if (z.ipv4().safeParse(value).success) return value;
	if (!z.ipv6().safeParse(value).success) return null;
	try {
		return new URL("http://[" + value + "]").hostname.slice(1, -1);
	} catch {
		return null;
	}
}
