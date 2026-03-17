/**
 * Authentication service
 */

import type { Env } from "../../shared/types.js";
import type { User } from "../types";
import type { ApiResponse } from "../types/api-response";

interface LoginRequest {
	email: string;
	password: string;
}

interface RegisterRequest {
	email: string;
	password: string;
	name?: string;
	terms_accepted: boolean;
}

import { ResponseBuilder } from "../types/response";
import { generateTokenPair, generateUUID, hashPassword, verifyPassword } from "../utils/security";
import { EmailService } from "./email-service";

export class AuthService {
	constructor(
		private db: D1Database,
		private env: Env,
	) {}

	/**
	 * Register a new user with modern email normalization
	 */
	async registerUser(request: RegisterRequest): Promise<
		ApiResponse<{
			user: {
				id: string;
				email: string;
				name?: string;
				avatar?: string;
				plan_type: string;
				created_at: string;
			};
			token: string;
			expires_at: string;
		}>
	> {
		try {
			// Normalize email to lowercase for case-insensitive uniqueness
			const normalizedEmail = request.email.toLowerCase().trim();

			// Check if email already exists (case-insensitive, any provider)
			const existingUser = await this.db
				.prepare("SELECT id, provider FROM users WHERE LOWER(email) = ?")
				.bind(normalizedEmail)
				.first();

			if (existingUser) {
				const provider = (existingUser as any).provider;
				const providerName = provider === "email" ? "email/password" : provider;
				return {
					success: false,
					error: {
						code: "EMAIL_ALREADY_EXISTS",
						message: `Email already registered with ${providerName} authentication`,
					},
				};
			}

			// Hash password
			const passwordHash = await hashPassword(request.password);

			// Create user with normalized email
			const userId = generateUUID();
			const now = new Date().toISOString();
			await this.db
				.prepare(
					`INSERT INTO users (id, email, password_hash, name, provider, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'email', ?, ?)`,
				)
				.bind(userId, normalizedEmail, passwordHash, request.name, now, now)
				.run();

			// Get created user
			const userResult = await this.db
				.prepare("SELECT * FROM users WHERE id = ?")
				.bind(userId)
				.first();

			if (!userResult) {
				throw new Error("Failed to create user");
			}

			const user = userResult as unknown as User;

			// Ensure user has required fields
			if (!user.id || !user.email || !user.created_at) {
				throw new Error("User object is missing required fields");
			}

			// Generate tokens (stateless JWT - no session object needed)
			const sessionId = generateUUID();

			// Get user's subscription plan type
			const { getUserPlanType, getPlanPermissions } = await import("../utils/subscription");
			const planType = await getUserPlanType(user.id!, this.db);
			const permissions = getPlanPermissions(planType);

			const tokens = await generateTokenPair(
				user,
				sessionId,
				planType,
				permissions,
				this.env.JWT_SECRET!,
			);

			// Note: Using stateless JWT authentication - no session storage needed

			return ResponseBuilder.success({
				user: {
					id: user.id!,
					email: user.email!,
					name: user.name || undefined,
					avatar: user.avatar || undefined,
					plan_type: planType,
					created_at: user.created_at!,
				},
				token: tokens.access_token,
				expires_at: tokens.expires_at,
			});
		} catch (error) {
			console.error("Registration error:", error);
			return ResponseBuilder.error("Registration failed", "INTERNAL_ERROR");
		}
	}

	/**
	 * Login user with modern email normalization
	 */
	async loginUser(request: LoginRequest): Promise<
		ApiResponse<{
			user: {
				id: string;
				email: string;
				name?: string;
				avatar?: string;
				plan_type: string;
				created_at: string;
			};
			token: string;
			expires_at: string;
		}>
	> {
		try {
			// Normalize email and find user with email provider only
			const normalizedEmail = request.email.toLowerCase().trim();
			const userResult = await this.db
				.prepare("SELECT * FROM users WHERE LOWER(email) = ? AND provider = 'email'")
				.bind(normalizedEmail)
				.first();

			const user = userResult as unknown as User | null;

			if (!user || !user.password_hash || !user.id) {
				return ResponseBuilder.error("Invalid email or password", "INVALID_CREDENTIALS");
			}

			// Verify password
			const isValidPassword = await verifyPassword(request.password, user.password_hash);
			if (!isValidPassword) {
				return ResponseBuilder.error("Invalid email or password", "INVALID_CREDENTIALS");
			}

			// Generate tokens (stateless JWT - no session object needed)
			const sessionId = generateUUID();

			// Get user's subscription plan type
			const { getUserPlanType, getPlanPermissions } = await import("../utils/subscription");
			const planType = await getUserPlanType(user.id!, this.db);
			const permissions = getPlanPermissions(planType);

			// Generate tokens
			const tokens = await generateTokenPair(
				user,
				sessionId,
				planType,
				permissions,
				this.env.JWT_SECRET!,
			);

			// Note: Using stateless JWT authentication - no session storage needed

			return {
				success: true,
				data: {
					user: {
						id: user.id!,
						email: user.email!,
						name: user.name || undefined,
						avatar: user.avatar || undefined,
						plan_type: planType,
						created_at: user.created_at!,
					},
					token: tokens.access_token,
					expires_at: tokens.expires_at,
				},
			};
		} catch (error) {
			console.error("Login error:", error);
			return {
				success: false,
				error: {
					code: "INTERNAL_ERROR",
					message: "Login failed",
				},
			};
		}
	}

	/**
	 * Forgot password - send reset email with modern email normalization
	 */
	async forgotPassword(email: string): Promise<ApiResponse<{ message: string }>> {
		try {
			// Normalize email and check if user exists with email provider
			const normalizedEmail = email.toLowerCase().trim();
			const user = (await this.db
				.prepare("SELECT id, email FROM users WHERE LOWER(email) = ? AND provider = 'email'")
				.bind(normalizedEmail)
				.first()) as User;

			if (!user) {
				// Don't reveal if email exists or not for security
				return {
					success: true,
					data: {
						message: "If the email exists, a reset link has been sent",
					},
				};
			}

			// Generate reset token
			const resetToken = generateUUID();
			const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

			// Save reset token to database
			await this.db
				.prepare(
					`UPDATE users
           SET reset_token = ?, reset_token_expires_at = ?, updated_at = ?
           WHERE id = ?`,
				)
				.bind(resetToken, expiresAt.toISOString(), new Date().toISOString(), user.id)
				.run();

			// Send reset email
			if (this.env.RESEND_API_KEY) {
				const emailService = new EmailService(this.env);
				const frontendUrl = this.env.FRONTEND_URL || "https://apple-rag.com";

				const emailSent = await emailService.sendPasswordResetEmail(email, resetToken, frontendUrl);

				if (!emailSent) {
					console.error("Failed to send password reset email");
				}
			}

			return {
				success: true,
				data: {
					message: "If the email exists, a reset link has been sent",
				},
			};
		} catch (error) {
			console.error("Forgot password error:", error);
			return {
				success: false,
				error: {
					code: "INTERNAL_ERROR",
					message: "Failed to process password reset request",
				},
			};
		}
	}

	/**
	 * Reset password using token
	 */
	async resetPassword(
		token: string,
		newPassword: string,
	): Promise<ApiResponse<{ message: string }>> {
		try {
			// Find user with valid reset token
			const user = (await this.db
				.prepare(
					`SELECT id, email, reset_token_expires_at
           FROM users
           WHERE reset_token = ?`,
				)
				.bind(token)
				.first()) as User & { reset_token_expires_at: string };

			if (!user) {
				return {
					success: false,
					error: {
						code: "INVALID_TOKEN",
						message: "Invalid or expired reset token",
					},
				};
			}

			// Check if token is expired
			const expiresAt = new Date(user.reset_token_expires_at);
			if (expiresAt < new Date()) {
				return {
					success: false,
					error: {
						code: "TOKEN_EXPIRED",
						message: "Reset token has expired",
					},
				};
			}

			// Hash new password
			const passwordHash = await hashPassword(newPassword);

			// Update password and clear reset token
			await this.db
				.prepare(
					`UPDATE users
           SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL, updated_at = ?
           WHERE id = ?`,
				)
				.bind(passwordHash, new Date().toISOString(), user.id)
				.run();

			return {
				success: true,
				data: {
					message: "Password has been reset successfully",
				},
			};
		} catch (error) {
			console.error("Reset password error:", error);
			return {
				success: false,
				error: {
					code: "INTERNAL_ERROR",
					message: "Failed to reset password",
				},
			};
		}
	}

	/**
	 * Modern password management with strict authentication isolation
	 * Only email users can manage passwords - OAuth users cannot set passwords
	 */
	async changePassword(
		userId: string,
		currentPassword: string,
		newPassword: string,
	): Promise<ApiResponse<{ message: string }>> {
		try {
			// Get user with provider and password info
			const user = (await this.db
				.prepare("SELECT id, email, provider, password_hash FROM users WHERE id = ?")
				.bind(userId)
				.first()) as User & { provider: string; password_hash: string | null };

			if (!user) {
				return {
					success: false,
					error: {
						code: "USER_NOT_FOUND",
						message: "User not found",
					},
				};
			}

			// Strict isolation: Only email users can manage passwords
			if (user.provider !== "email") {
				return {
					success: false,
					error: {
						code: "OPERATION_NOT_ALLOWED",
						message: `Password management is not available for ${user.provider} authentication. Please use ${user.provider} to manage your account.`,
					},
				};
			}

			// Verify current password
			if (!user.password_hash) {
				return {
					success: false,
					error: {
						code: "INVALID_ACCOUNT_STATE",
						message: "Account does not have a password set",
					},
				};
			}

			const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password_hash);

			if (!isCurrentPasswordValid) {
				return {
					success: false,
					error: {
						code: "INVALID_PASSWORD",
						message: "Current password is incorrect",
					},
				};
			}

			// Hash new password
			const newPasswordHash = await hashPassword(newPassword);

			// Update password in database
			await this.db
				.prepare(
					`UPDATE users
           SET password_hash = ?, updated_at = ?
           WHERE id = ?`,
				)
				.bind(newPasswordHash, new Date().toISOString(), userId)
				.run();

			return {
				success: true,
				data: {
					message: "Password has been changed successfully",
				},
			};
		} catch (error) {
			console.error("Password change error:", error);
			return {
				success: false,
				error: {
					code: "INTERNAL_ERROR",
					message: "Failed to change password",
				},
			};
		}
	}

	/**
	 * Get user authentication status with strict isolation policy
	 */
	async getUserAuthStatus(userId: string): Promise<
		ApiResponse<{
			provider: string;
			canChangePassword: boolean;
			authenticationMethod: string;
		}>
	> {
		try {
			const user = (await this.db
				.prepare("SELECT provider, password_hash FROM users WHERE id = ?")
				.bind(userId)
				.first()) as { provider: string; password_hash: string | null } | null;

			if (!user) {
				return {
					success: false,
					error: {
						code: "USER_NOT_FOUND",
						message: "User not found",
					},
				};
			}

			const isEmailUser = user.provider === "email";
			const hasPassword = user.password_hash !== null;

			// Strict isolation: Only email users can change passwords
			const canChangePassword = isEmailUser && hasPassword;

			const authenticationMethod = isEmailUser
				? "Email & Password"
				: user.provider === "google"
					? "Google OAuth"
					: "GitHub OAuth";

			return {
				success: true,
				data: {
					provider: user.provider,
					canChangePassword,
					authenticationMethod,
				},
			};
		} catch (error) {
			console.error("Get auth status error:", error);
			return {
				success: false,
				error: {
					code: "INTERNAL_ERROR",
					message: "Failed to get authentication status",
				},
			};
		}
	}
}
