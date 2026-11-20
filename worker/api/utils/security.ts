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
