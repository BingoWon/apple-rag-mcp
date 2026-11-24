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
