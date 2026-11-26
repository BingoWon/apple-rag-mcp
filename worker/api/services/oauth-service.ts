/**
 * OAuth service with unified JWT auth: OAuth login → JWT token generation
 */

import type { Env } from "../../shared/types.js";
import type { User } from "../types";
import { getPlanPermissions, getUserPlanType } from "../utils/subscription";
import { notifyTelegram } from "../utils/telegram-notifier.js";
import { issueWebSession } from "../utils/web-session";

const emailConflict = "This email is already registered. Use your existing sign-in method.";

// OAuth provider response types
interface GoogleUserInfo {
	id: string;
	email: string;
	verified_email?: boolean;
	name: string;
	picture: string;
}

interface UserProfile {
	email: string;
	name: string;
	avatar?: string;
	provider: string;
	provider_id: string;
}

interface OAuthTokens {
	access_token: string;
	refresh_token?: string;
	expires_in?: number;
}

export class OAuthService {
	constructor(
		private env: Env,
		private origin: string,
	) {}

	/**
	 * Returns OAuth authorization URL.
	 */
	getAuthUrl(provider: "google" | "github", state: string): string {
		const redirectUri = `${this.origin}/api/oauth/${provider}/callback`;

		console.log(`Website OAuth ${provider} redirect URI:`, redirectUri);

		if (provider === "google") {
			const params = new URLSearchParams({
				client_id: this.env.GOOGLE_CLIENT_ID!,
				redirect_uri: redirectUri,
				response_type: "code",
				scope: "email profile",
				state,
			});
			return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
		}

		if (provider === "github") {
			const params = new URLSearchParams({
				client_id: this.env.GITHUB_CLIENT_ID!,
				redirect_uri: redirectUri,
				scope: "user:email read:user",
				state,
			});
			return `https://github.com/login/oauth/authorize?${params}`;
		}

		throw new Error(`Unsupported OAuth provider: ${provider}`);
	}

	/**
	 * Handles OAuth callback and issues JWT token.
	 */
	async handleCallback(
		provider: "google" | "github",
		code: string,
		signupSource?: string | null,
	): Promise<{ success: true; token: string } | { success: false; error: string }> {
		try {
			const tokens = await this.exchangeCodeForTokens(provider, code);
			const profile = await this.getUserInfo(provider, tokens.access_token);
			return { success: true, token: await this.signIn(profile, signupSource ?? null) };
		} catch (error) {
			console.error(`OAuth ${provider} callback error:`, error);
			return {
				success: false,
				error:
					error instanceof Error && error.message === emailConflict
						? "account_exists"
						: "oauth_failed",
			};
		}
	}

	/**
	 * Exchanges authorization code for access tokens.
	 */
	private async exchangeCodeForTokens(
		provider: "google" | "github",
		code: string,
	): Promise<OAuthTokens> {
		const redirectUri = `${this.origin}/api/oauth/${provider}/callback`;

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

			const tokens = (await response.json()) as Partial<OAuthTokens> & {
				error?: string;
				error_description?: string;
			};
			if (!tokens.access_token) {
				throw new Error(
					`Google token exchange returned no access token: ${tokens.error_description || tokens.error || "unknown error"}`,
				);
			}

			return tokens as OAuthTokens;
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

			const tokens = (await response.json()) as Partial<OAuthTokens> & {
				error?: string;
				error_description?: string;
			};
			if (!tokens.access_token) {
				throw new Error(
					`GitHub token exchange failed: ${tokens.error_description || tokens.error || "missing access_token"}`,
				);
			}

			return tokens as OAuthTokens;
		}

		throw new Error(`Unsupported provider: ${provider}`);
	}

	/**
	 * Fetches user profile from provider.
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
			if (!data.email || data.verified_email !== true) {
				throw new Error("Google account email is not verified");
			}
			return {
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

				const userData = (await userResponse.json()) as Record<string, unknown>;
				const emailData = (await emailResponse.json()) as Record<string, unknown>[];

				const primaryEmail =
					emailData.find(
						(email: Record<string, unknown>) => email.primary === true && email.verified === true,
					)?.email ||
					emailData.find((email: Record<string, unknown>) => email.verified === true)?.email;

				if (!primaryEmail || typeof primaryEmail !== "string") {
					throw new Error("No verified email found in GitHub user data");
				}

				return {
					email: primaryEmail as string,
					name: (userData.name || userData.login || "GitHub User") as string,
					avatar: userData.avatar_url as string | undefined,
					provider: "github",
					provider_id: String(userData.id),
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

	private async signIn(profile: UserProfile, signupSource: string | null = null) {
		const email = profile.email.toLowerCase().trim();
		const existing = await this.env.DB.prepare(
			"SELECT id,created_at FROM users WHERE provider=? AND provider_id=?",
		)
			.bind(profile.provider, profile.provider_id)
			.first<Pick<User, "id" | "created_at">>();
		if (
			!existing &&
			(await this.env.DB.prepare("SELECT 1 FROM users WHERE LOWER(email)=?").bind(email).first())
		) {
			throw Error(emailConflict);
		}
		const now = new Date().toISOString();
		const user: User = {
			...profile,
			email,
			id: existing?.id ?? crypto.randomUUID(),
			created_at: existing?.created_at ?? now,
			updated_at: now,
		};
		const writeUser = existing
			? this.env.DB.prepare(
					"UPDATE users SET email=?,name=?,avatar=?,last_login=?,updated_at=? WHERE id=?",
				).bind(email, user.name, user.avatar ?? null, now, now, user.id)
			: this.env.DB.prepare(
					"INSERT INTO users(id,email,name,avatar,provider,provider_id,signup_source,last_login,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
				).bind(
					user.id,
					email,
					user.name,
					user.avatar ?? null,
					profile.provider,
					profile.provider_id,
					signupSource,
					now,
					now,
					now,
				);
		const plan = existing ? await getUserPlanType(user.id, this.env.DB) : "hobby";
		try {
			const { token } = await issueWebSession(
				this.env.DB,
				user,
				plan,
				getPlanPermissions(plan),
				this.env.JWT_SECRET,
				{ handoff: true, writeUser },
			);
			if (!existing)
				await notifyTelegram(
					`👤 New OAuth Registration\nProvider: ${profile.provider}\nEmail: ${email}${signupSource ? `\nSource: ${signupSource}` : ""}`,
				);
			return token;
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("UNIQUE constraint failed: users.email")
			) {
				throw Error(emailConflict);
			}
			throw error;
		}
	}
}
