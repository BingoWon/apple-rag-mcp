/**
 * Validation utility functions and schemas
 */
import { z } from "zod";

export function normalizeSignupSource(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const cleaned = raw
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._:/-]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 64);
	return cleaned || null;
}

// User registration validation
export const registerSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
	name: z.string().optional(),
	terms_accepted: z.boolean().refine((val) => val === true, "Terms must be accepted"),
	signup_source: z.string().max(120).optional(),
});

// User login validation
export const loginSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(1, "Password is required"),
});

// Forgot password validation
export const forgotPasswordSchema = z.object({
	email: z.string().email("Invalid email address"),
});

// Reset password validation
export const resetPasswordSchema = z.object({
	token: z.string().min(1, "Reset token is required"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

// MCP token creation validation (ultimate simplified)
export const createMCPTokenSchema = z.object({
	name: z.string().min(1, "Name is required").max(100, "Name too long"),
});
