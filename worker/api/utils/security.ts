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
 * Generate cryptographically secure UUID v4
 */
export function generateUUID(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));

	// Set version (4) and variant bits
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

	return [
		hex.slice(0, 8),
		hex.slice(8, 12),
		hex.slice(12, 16),
		hex.slice(16, 20),
		hex.slice(20, 32),
	].join("-");
}

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

// =============================================================================
// JWT Token Management (re-exported from jwt-simple)
// =============================================================================

export { generateTokenPair, verifyToken } from "./jwt-simple";
