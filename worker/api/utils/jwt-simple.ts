/**
 * Modern JWT Implementation for Cloudflare Workers
 * Optimized for Workers environment with Web Crypto API
 */

import type { User } from "../types";
import type { JWTPayload, RefreshTokenPayload, TokenPair } from "../types/jwt";

/**
 * Base64 URL encode
 */
function base64UrlEncode(str: string): string {
	return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Base64 URL decode
 */
function base64UrlDecode(str: string): string {
	str += "=".repeat((4 - (str.length % 4)) % 4);
	return atob(str.replace(/-/g, "+").replace(/_/g, "/"));
}

/**
 * Create HMAC SHA-256 signature
 */
async function createSignature(data: string, secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
	return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Verify HMAC SHA-256 signature
 */
async function verifySignature(data: string, signature: string, secret: string): Promise<boolean> {
	const expectedSignature = await createSignature(data, secret);
	return expectedSignature === signature;
}

/**
 * Generate JWT token
 */
async function signJWT(payload: any, secret: string): Promise<string> {
	const header = {
		alg: "HS256",
		typ: "JWT",
	};

	const encodedHeader = base64UrlEncode(JSON.stringify(header));
	const encodedPayload = base64UrlEncode(JSON.stringify(payload));
	const data = `${encodedHeader}.${encodedPayload}`;
	const signature = await createSignature(data, secret);

	return `${data}.${signature}`;
}

/**
 * Verify JWT token
 */
async function verifyJWT(token: string, secret: string): Promise<any> {
	const parts = token.split(".");
	if (parts.length !== 3) {
		throw new Error("Invalid token format");
	}

	const [encodedHeader, encodedPayload, signature] = parts;
	const data = `${encodedHeader}.${encodedPayload}`;

	const isValid = await verifySignature(data, signature, secret);
	if (!isValid) {
		throw new Error("Invalid signature");
	}

	const payload = JSON.parse(base64UrlDecode(encodedPayload));

	// Check expiration
	if (payload.exp && Date.now() / 1000 > payload.exp) {
		throw new Error("Token expired");
	}

	return payload;
}

/**
 * Generate JWT access token
 */
export async function generateAccessToken(
	user: User,
	sessionId: string,
	planType: string,
	permissions: string[],
	secret: string,
): Promise<string> {
	const payload: JWTPayload = {
		sub: user.id,
		email: user.email,
		name: user.name,
		avatar: user.avatar,
		created_at: user.created_at,
		plan_type: planType,
		permissions,
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 100 * 365 * 24 * 60 * 60, // 100 years - 永久登录
		jti: sessionId,
	};

	return signJWT(payload, secret);
}

/**
 * Generate refresh token
 */
export async function generateRefreshToken(
	userId: string,
	sessionId: string,
	secret: string,
): Promise<string> {
	const payload: RefreshTokenPayload = {
		sub: userId,
		jti: sessionId,
		type: "refresh",
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 100 * 365 * 24 * 60 * 60, // 100 years - 永久登录
	};

	return signJWT(payload, secret);
}

/**
 * Generate token pair
 */
export async function generateTokenPair(
	user: User,
	sessionId: string,
	planType: string,
	permissions: string[],
	secret: string,
): Promise<TokenPair> {
	const accessToken = await generateAccessToken(user, sessionId, planType, permissions, secret);
	const refreshToken = await generateRefreshToken(user.id, sessionId, secret);

	return {
		access_token: accessToken,
		refresh_token: refreshToken,
		expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
		token_type: "Bearer",
	};
}

/**
 * Verify JWT token
 */
export async function verifyToken(token: string, secret: string): Promise<JWTPayload> {
	return (await verifyJWT(token, secret)) as JWTPayload;
}

/**
 * Verify refresh token
 */
export async function verifyRefreshToken(
	token: string,
	secret: string,
): Promise<RefreshTokenPayload> {
	const payload = (await verifyJWT(token, secret)) as RefreshTokenPayload;
	if (payload.type !== "refresh") {
		throw new Error("Invalid token type");
	}
	return payload;
}
