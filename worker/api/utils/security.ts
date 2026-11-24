/**
 * Unified Security Module
 * Modern, elegant, and minimal security utilities for Cloudflare Workers
 */

import bcrypt from "bcryptjs";

// =============================================================================
// Password Security (using bcrypt - industry standard)
// =============================================================================

/**
 * Hash password using bcrypt with optimal rounds for Workers environment
 */
export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 12);
}

/**
 * Verify password against bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

// =============================================================================
// Cryptographic Utilities (using Web Crypto API)
// =============================================================================

/**
 * Hash string using SHA-256
 */
export async function hashString(input: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = new Uint8Array(hashBuffer);

	return Array.from(hashArray, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Constant-time string comparison without leaking secret length.
 */
export async function timingSafeEqual(
	a: string | undefined,
	b: string | undefined,
): Promise<boolean> {
	if (!a || !b) return false;
	const encoder = new TextEncoder();
	const [digestA, digestB] = await Promise.all([
		crypto.subtle.digest("SHA-256", encoder.encode(a)),
		crypto.subtle.digest("SHA-256", encoder.encode(b)),
	]);
	const subtle = crypto.subtle as SubtleCrypto & {
		timingSafeEqual?: (
			a: ArrayBuffer | ArrayBufferView,
			b: ArrayBuffer | ArrayBufferView,
		) => boolean;
	};
	if (typeof subtle.timingSafeEqual === "function") {
		return subtle.timingSafeEqual(digestA, digestB);
	}
	const bytesA = new Uint8Array(digestA);
	const bytesB = new Uint8Array(digestB);
	let diff = 0;
	for (let i = 0; i < bytesA.length; i++) {
		diff |= bytesA[i] ^ bytesB[i];
	}
	return diff === 0;
}
