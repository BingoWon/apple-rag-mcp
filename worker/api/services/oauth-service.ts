/**
 * 现代化OAuth服务 - 统一JWT认证架构
 * OAuth登录 → JWT Token生成 → 统一认证系统
 */

import type { User } from "../types";
import type { Env } from "../types/env";
import { generateTokenPair } from "../utils/jwt-simple";
import { generateUUID } from "../utils/security";
import { notifyTelegram } from "../utils/telegram-notifier.js";

// OAuth provider response types
interface GoogleUserInfo {
	id: string;
	email: string;
	name: string;
	picture: string;
}

interface UserProfile {
	id: string;
	email: string;
	name: string;
	avatar?: string;
	provider: string;
	provider_id: string;
	plan_type?: string;
	created_at?: string;
	updated_at?: string;
}

interface OAuthTokens {
	access_token: string;
	refresh_token?: string;
	expires_in?: number;
}

export class OAuthService {
	constructor(private env: Env) {}

	/**
	 * 获取OAuth授权URL
	 */
	getAuthUrl(provider: "google" | "github", state?: string): string {
		// 使用 OAUTH_REDIRECT_BASE 环境变量，支持开发和生产环境
		const baseUrl = this.env.OAUTH_REDIRECT_BASE || "https://apple-rag.com/api";
		const redirectUri = `${baseUrl}/oauth/${provider}/callback`;

		// 调试日志：记录实际使用的重定向URI
		console.log(`Website OAuth ${provider} redirect URI:`, redirectUri);

		if (provider === "google") {
			const params = new URLSearchParams({
				client_id: this.env.GOOGLE_CLIENT_ID!,
				redirect_uri: redirectUri,
				response_type: "code",
				scope: "email profile",
				state: state || "",
			});
			return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
		}

		if (provider === "github") {
			const params = new URLSearchParams({
				client_id: this.env.GITHUB_CLIENT_ID!,
				redirect_uri: redirectUri,
				scope: "user:email read:user",
				state: state || "",
			});
			return `https://github.com/login/oauth/authorize?${params}`;
		}

		throw new Error(`Unsupported OAuth provider: ${provider}`);
	}

	/**
	 * 处理OAuth回调并生成JWT Token
	 */
	async handleCallback(
		provider: "google" | "github",
		code: string,
		userAgent?: string,
		ipAddress?: string,
	): Promise<{
		success: boolean;
		data?: {
			user: UserProfile;
			jwtToken: string;
			expiresAt: string;
		};
		error?: string;
	}> {
		try {
			// 1. 用授权码换取访问令牌
			const tokens = await this.exchangeCodeForTokens(provider, code);

			// 2. 获取用户信息
			const userInfo = await this.getUserInfo(provider, tokens.access_token);

			// 3. 在数据库中创建或更新用户
			const user = await this.createOrUpdateUser(userInfo);

			// 4. 生成JWT Token供网站认证使用
			const jwtToken = await this.generateJwtToken(user, userAgent, ipAddress);

			return {
				success: true,
				data: {
					user,
					jwtToken: jwtToken.token,
					expiresAt: jwtToken.expiresAt,
				},
			};
		} catch (error) {
			console.error(`OAuth ${provider} callback error:`, error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "OAuth authentication failed",
			};
		}
	}

	/**
	 * 用授权码换取访问令牌
	 */
	private async exchangeCodeForTokens(
		provider: "google" | "github",
		code: string,
	): Promise<OAuthTokens> {
		const baseUrl = this.env.OAUTH_REDIRECT_BASE || "https://apple-rag.com/api";
		const redirectUri = `${baseUrl}/oauth/${provider}/callback`;

		if (provider === "google") {
			const response = await fetch("https://oauth2.googleapis.com/token", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					client_id: this.env.GOOGLE_CLIENT_ID!,
					client_secret: this.env.GOOGLE_CLIENT_SECRET!,
					code,
					grant_type: "authorization_code",
					redirect_uri: redirectUri,
				}),
			});

			if (!response.ok) {
				throw new Error(`Google token exchange failed: ${response.statusText}`);
			}

			return await response.json();
		}

		if (provider === "github") {
			const response = await fetch("https://github.com/login/oauth/access_token", {
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					client_id: this.env.GITHUB_CLIENT_ID!,
					client_secret: this.env.GITHUB_CLIENT_SECRET!,
					code,
					redirect_uri: redirectUri,
				}),
			});

			if (!response.ok) {
				throw new Error(`GitHub token exchange failed: ${response.statusText}`);
			}

			return await response.json();
		}

		throw new Error(`Unsupported provider: ${provider}`);
	}

	/**
	 * 获取用户信息
	 */
	private async getUserInfo(
		provider: "google" | "github",
		accessToken: string,
	): Promise<UserProfile> {
		if (provider === "google") {
			const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
				headers: { Authorization: `Bearer ${accessToken}` },
			});

			if (!response.ok) {
				throw new Error(`Google user info failed: ${response.statusText}`);
			}

			const data = (await response.json()) as GoogleUserInfo;
			return {
				id: `google_${data.id}`,
				email: data.email,
				name: data.name,
				avatar: data.picture,
				provider: "google",
				provider_id: data.id,
			};
		}

		if (provider === "github") {
			try {
				const [userResponse, emailResponse] = await Promise.all([
					fetch("https://api.github.com/user", {
						headers: {
							Authorization: `Bearer ${accessToken}`,
							"User-Agent": "Apple-RAG-OAuth",
						},
					}),
					fetch("https://api.github.com/user/emails", {
						headers: {
							Authorization: `Bearer ${accessToken}`,
							"User-Agent": "Apple-RAG-OAuth",
						},
					}),
				]);

				if (!userResponse.ok) {
					const errorText = await userResponse.text();
					console.error("GitHub user API error:", userResponse.status, errorText);
					throw new Error(`GitHub user info failed: ${userResponse.status} ${errorText}`);
				}

				if (!emailResponse.ok) {
					const errorText = await emailResponse.text();
					console.error("GitHub email API error:", emailResponse.status, errorText);
					throw new Error(`GitHub email info failed: ${emailResponse.status} ${errorText}`);
				}

				const userData = (await userResponse.json()) as any;
				const emailData = (await emailResponse.json()) as any[];

				const primaryEmail = emailData.find((email: any) => email.primary)?.email || userData.email;

				if (!primaryEmail) {
					throw new Error("No email found in GitHub user data");
				}

				return {
					id: `github_${userData.id}`,
					email: primaryEmail,
					name: userData.name || userData.login || "GitHub User",
					avatar: userData.avatar_url,
					provider: "github",
					provider_id: userData.id.toString(),
				};
			} catch (error) {
				console.error("GitHub getUserInfo error:", error);
				throw new Error(
					`GitHub user info failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		}

		throw new Error(`Unsupported provider: ${provider}`);
	}

	/**
	 * 创建或更新用户 - 现代化邮箱处理和严格隔离策略
	 */
	private async createOrUpdateUser(userInfo: UserProfile): Promise<UserProfile> {
		// 规范化邮箱地址
		const normalizedEmail = userInfo.email.toLowerCase().trim();

		// 严格隔离策略：只检查相同 provider 的用户
		const existingUser = await this.env.DB.prepare(
			"SELECT * FROM users WHERE provider = ? AND provider_id = ?",
		)
			.bind(userInfo.provider, userInfo.provider_id)
			.first();

		if (existingUser) {
			// 更新现有用户 - 使用规范化邮箱
			const now = new Date().toISOString();
			await this.env.DB.prepare(
				`UPDATE users SET
         email = ?, name = ?, avatar = ?, last_login = ?, updated_at = ?
         WHERE id = ?`,
			)
				.bind(normalizedEmail, userInfo.name, userInfo.avatar, now, now, existingUser.id)
				.run();

			// Get user's subscription plan type
			const { getUserPlanType } = await import("../utils/subscription");
			const planType = await getUserPlanType(existingUser.id as string, this.env.DB);

			// 获取更新后的完整用户数据，包含数据库时间戳
			const updatedUser = await this.env.DB.prepare(
				"SELECT id, email, name, avatar, provider, provider_id, created_at, updated_at FROM users WHERE id = ?",
			)
				.bind(existingUser.id)
				.first();

			return {
				...userInfo,
				email: normalizedEmail,
				id: existingUser.id as string,
				plan_type: planType,
				created_at: updatedUser?.created_at as string,
				updated_at: updatedUser?.updated_at as string,
			};
		} else {
			// 检查是否存在相同邮箱的其他认证方式用户
			const emailConflict = await this.env.DB.prepare(
				"SELECT id, provider FROM users WHERE LOWER(email) = ?",
			)
				.bind(normalizedEmail)
				.first();

			if (emailConflict) {
				const conflictProvider = (emailConflict as any).provider;
				throw new Error(
					`Email ${normalizedEmail} is already registered with ${conflictProvider} authentication. Please use ${conflictProvider} to sign in.`,
				);
			}

			// 创建新用户 - 使用规范化邮箱
			const userId = crypto.randomUUID();
			const now = new Date().toISOString();

			await this.env.DB.prepare(
				`INSERT INTO users (id, email, name, avatar, provider, provider_id, created_at, updated_at, last_login)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
				.bind(
					userId,
					normalizedEmail,
					userInfo.name,
					userInfo.avatar,
					userInfo.provider,
					userInfo.provider_id,
					now,
					now,
					now,
				)
				.run();

			// 获取新创建用户的完整数据，包含数据库时间戳
			const newUser = await this.env.DB.prepare(
				"SELECT id, email, name, avatar, provider, provider_id, created_at, updated_at FROM users WHERE id = ?",
			)
				.bind(userId)
				.first();

			const providerLabel =
				userInfo.provider === "google"
					? "Google"
					: userInfo.provider === "github"
						? "GitHub"
						: userInfo.provider;
			await notifyTelegram(`👤 New OAuth Registration
Provider: ${providerLabel}
Email: ${normalizedEmail}`);

			// New users start with hobby plan
			return {
				...userInfo,
				email: normalizedEmail,
				id: userId,
				plan_type: "hobby",
				created_at: newUser?.created_at as string,
				updated_at: newUser?.updated_at as string,
			};
		}
	}

	/**
	 * 为用户生成JWT Token - 统一认证系统
	 */
	private async generateJwtToken(
		user: UserProfile,
		_userAgent?: string,
		_ipAddress?: string,
	): Promise<{
		token: string;
		expiresAt: string;
	}> {
		// Generate session ID (stateless JWT - no session object needed)
		const sessionId = generateUUID();

		// 获取用户订阅计划类型 (从 user_subscriptions 表)
		const { getUserPlanType, getPlanPermissions } = await import("../utils/subscription");
		const planType = await getUserPlanType(user.id, this.env.DB);
		const permissions = getPlanPermissions(planType);

		// 使用 createOrUpdateUser 返回的完整用户数据，无需额外查询
		const userForToken: User = {
			id: user.id,
			email: user.email,
			name: user.name,
			avatar: user.avatar,
			created_at: user.created_at!,
			updated_at: user.updated_at!,
		};

		const tokens = await generateTokenPair(
			userForToken,
			sessionId,
			planType,
			permissions,
			this.env.JWT_SECRET!,
		);

		// Note: Using stateless JWT authentication - no session storage needed

		return {
			token: tokens.access_token,
			expiresAt: tokens.expires_at,
		};
	}
}
