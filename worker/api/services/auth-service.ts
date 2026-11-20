/**
 * Authentication service
 */

import type { Env } from "../../shared/types.js";
import type { User } from "../types";
import type { ApiResponse } from "../types/api-response";
import { issueWebSession } from "../utils/web-session";

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
import { hashPassword, verifyPassword } from "../utils/security";
import { getPlanPermissions, getUserPlanType, type PlanType } from "../utils/subscription";
import { EmailService } from "./email-service";

export class AuthService {
	constructor(
		private db: D1Database,
		private env: Env,
	) {}

	async registerUser(request: RegisterRequest) {
		const email = request.email.toLowerCase().trim();
		try {
			const conflict = await this.db
				.prepare("SELECT provider FROM users WHERE LOWER(email)=?")
				.bind(email)
				.first<{ provider: string }>();
			if (conflict)
				return ResponseBuilder.error(
					"EMAIL_ALREADY_EXISTS",
					`Email already registered with ${conflict.provider === "email" ? "email/password" : conflict.provider} authentication.`,
				);
			const now = new Date().toISOString();
			const user: User = {
				id: crypto.randomUUID(),
				email,
				name: request.name,
				provider: "email",
				password_hash: await hashPassword(request.password),
				created_at: now,
				updated_at: now,
			};
			const insert = this.db
				.prepare(
					`INSERT INTO users (id,email,password_hash,name,provider,created_at,updated_at) VALUES(?,?,?,?,'email',?,?)`,
				)
				.bind(user.id, user.email, user.password_hash!, user.name ?? null, now, now);
			return await this.signedIn(user, "hobby", insert);
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("UNIQUE constraint failed: users.email")
			) {
				return ResponseBuilder.error(
					"EMAIL_ALREADY_EXISTS",
					"This email is already registered. Sign in with your existing account.",
				);
			}
			console.error("Registration failed", error);
			return ResponseBuilder.error("INTERNAL_ERROR", "Registration failed");
		}
	}

	async loginUser(request: LoginRequest) {
		try {
			const user = await this.db
				.prepare("SELECT * FROM users WHERE LOWER(email)=? AND provider='email'")
				.bind(request.email.toLowerCase().trim())
				.first<User>();
			if (!user?.password_hash || !(await verifyPassword(request.password, user.password_hash)))
				return ResponseBuilder.error("INVALID_CREDENTIALS", "Invalid email or password");
			return await this.signedIn(user, await getUserPlanType(user.id, this.db));
		} catch (error) {
			console.error("Login failed", error);
			return ResponseBuilder.error("INTERNAL_ERROR", "Login failed");
		}
	}

	private async signedIn(user: User, plan: PlanType, writeUser?: D1PreparedStatement) {
		const session = await issueWebSession(
			this.db,
			user,
			plan,
			getPlanPermissions(plan),
			this.env.JWT_SECRET,
			{ writeUser },
		);
		return ResponseBuilder.success({
			user: {
				id: user.id,
				email: user.email,
				name: user.name || undefined,
				avatar: user.avatar || undefined,
				plan_type: plan,
				created_at: user.created_at,
			},
			...session,
		});
	}

	/**
	 * Forgot password - send reset email with modern email normalization
	 */
	async forgotPassword(email: string, origin: string): Promise<ApiResponse<{ message: string }>> {
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
			const resetToken = crypto.randomUUID();
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

				const emailSent = await emailService.sendPasswordResetEmail(email, resetToken, origin);

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
			const updated = await this.db
				.prepare(
					"UPDATE users SET password_hash=?,reset_token=NULL,reset_token_expires_at=NULL,updated_at=? WHERE id=? AND reset_token=? AND julianday(reset_token_expires_at)>julianday('now') RETURNING id",
				)
				.bind(passwordHash, new Date().toISOString(), user.id, token)
				.first();
			if (!updated) return ResponseBuilder.error("INVALID_TOKEN", "Invalid or expired reset token");

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

			// Require the same password version that was verified before hashing.
			const changed = await this.db
				.prepare(
					`UPDATE users
           SET password_hash = ?, reset_token=NULL,reset_token_expires_at=NULL, updated_at = ?
           WHERE id = ? AND password_hash=? RETURNING id`,
				)
				.bind(newPasswordHash, new Date().toISOString(), userId, user.password_hash)
				.first();
			if (!changed)
				return ResponseBuilder.error(
					"INVALID_PASSWORD",
					"Sign in again before changing your password.",
				);

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
