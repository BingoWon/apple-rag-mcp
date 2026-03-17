/**
 * Validation utility functions and schemas
 */
import { z } from "zod";

// User registration validation
export const registerSchema = z.object({
	email: z.string().email("Invalid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
	name: z.string().optional(),
	terms_accepted: z.boolean().refine((val) => val === true, "Terms must be accepted"),
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

// Subscription checkout validation
export const createCheckoutSessionSchema = z.object({
	plan_id: z.enum(["pro", "enterprise"], {
		message: "Valid plan ID required",
	}),
	billing_cycle: z.enum(["monthly", "yearly"]).optional(),
});

// Subscription update validation
export const updateSubscriptionSchema = z.object({
	plan_id: z.string().optional(),
	cancel_at_period_end: z.boolean().optional(),
});

// Usage stats validation
export const usageStatsSchema = z.object({
	period: z
		.string()
		.regex(/^\d+d$/, 'Period must be in format "30d"')
		.optional(),
	granularity: z.enum(["hour", "day", "week"]).optional(),
});

// MCP token format validation
export function validateMCPTokenFormat(token: string): boolean {
	return /^at_(test|prod)_[a-zA-Z0-9_]+$/.test(token);
}

// Email format validation
export function validateEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

// Password strength validation
export function validatePasswordStrength(password: string): {
	isValid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	if (password.length < 8) {
		errors.push("Password must be at least 8 characters long");
	}

	if (!/[a-z]/.test(password)) {
		errors.push("Password must contain at least one lowercase letter");
	}

	if (!/[A-Z]/.test(password)) {
		errors.push("Password must contain at least one uppercase letter");
	}

	if (!/\d/.test(password)) {
		errors.push("Password must contain at least one number");
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

// Sanitize user input
export function sanitizeString(input: string): string {
	return input.trim().replace(/[<>]/g, "");
}

// Validate UUID format
export function validateUUID(uuid: string): boolean {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(uuid);
}
