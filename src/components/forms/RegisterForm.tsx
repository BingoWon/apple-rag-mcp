import { IconBrandGithub, IconBrandGoogle, IconXboxX } from "@tabler/icons-react";
import type React from "react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { FormContainer } from "@/components/ui/FormContainer";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { LabelInputContainer } from "@/components/ui/LabelInputContainer";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";
import { api } from "@/lib/api";
import { normalizeEmail } from "@/utils/email";
import { getFriendlyErrorMessage } from "@/utils/errorMessages";

export function RegisterForm() {
	const [isLoading, setIsLoading] = useState(false);
	const [oauthLoading, setOauthLoading] = useState<string | null>(null);

	const [passwordError, setPasswordError] = useState("");
	const [error, setError] = useState<string | null>(null);
	const navigate = useNavigate();
	const { register: registerUser } = useAuth();
	const { t } = useTranslation();

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsLoading(true);
		setPasswordError("");
		setError(null); // Clear previous errors

		const formData = new FormData(e.currentTarget);
		const email = normalizeEmail(formData.get("email") as string);
		const password = formData.get("password") as string;
		const confirmPassword = formData.get("confirmPassword") as string;

		// Password matching validation
		if (password !== confirmPassword) {
			setPasswordError(t("auth.passwords_mismatch"));
			setIsLoading(false);
			return;
		}

		try {
			await registerUser({
				name: email.split("@")[0], // Use email prefix as name
				email,
				password,
				terms_accepted: true,
			});

			// Track successful registration
			trackEvent("USER_REGISTER", {
				method: "email",
				user_email: email,
			});

			navigate("/overview/", { replace: true });
		} catch (error) {
			// 提取错误码和消息
			let errorCode: string | undefined;
			let errorMessage: string;

			if (error instanceof Error) {
				errorMessage = error.message;
				// 尝试从错误消息中提取错误码
				const codeMatch = errorMessage.match(/^([A-Z_]+):/);
				if (codeMatch) {
					errorCode = codeMatch[1];
				}
			} else {
				errorMessage = "Registration failed. Please try again.";
			}

			// 使用友好的错误信息
			const friendlyMessage = getFriendlyErrorMessage(errorCode, errorMessage);
			setError(friendlyMessage);
		} finally {
			setIsLoading(false);
		}
	};

	const handleOAuthLogin = async (provider: "google" | "github") => {
		setOauthLoading(provider);

		try {
			// 现代化OAuth流程：获取授权URL然后跳转
			const response =
				provider === "google" ? await api.getGoogleAuthUrl() : await api.getGitHubAuthUrl();

			if (response.success && response.data) {
				const data = response.data as { auth_url?: string };
				if (data.auth_url) {
					window.location.href = data.auth_url;
				}
			} else {
				throw new Error("Failed to get authorization URL");
			}
		} catch (error) {
			console.error(`${provider} OAuth error:`, error);
			toast.error(t("auth.oauth_failed"));
			setOauthLoading(null);
		}
	};

	return (
		<FormContainer title={t("auth.welcome_register")} subtitle={t("auth.sign_up_subtitle")}>
			<div className="space-y-6">
				{/* OAuth Registration Buttons - Top Priority */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<Button
						variant="outline"
						onClick={() => handleOAuthLogin("google")}
						disabled={oauthLoading !== null || isLoading}
						className="w-full h-11"
					>
						<IconBrandGoogle className="h-5 w-5 mr-3" />
						{oauthLoading === "google" ? t("common.connecting") : "Google"}
					</Button>
					<Button
						variant="ghost"
						onClick={() => handleOAuthLogin("github")}
						disabled={oauthLoading !== null || isLoading}
						className="w-full h-11"
					>
						<IconBrandGithub className="h-5 w-5 mr-3" />
						{oauthLoading === "github" ? t("common.connecting") : "GitHub"}
					</Button>
				</div>

				{/* Divider */}
				<div className="relative">
					<div className="absolute inset-0 flex items-center">
						<div className="w-full border-t border-border" />
					</div>
					<div className="relative flex justify-center text-xs uppercase">
						<span className="bg-card px-3 text-muted-foreground font-medium">
							{t("auth.or_email")}
						</span>
					</div>
				</div>

				{/* Email/Password Form */}
				<form name="registration" onSubmit={handleSubmit}>
					{/* Error Message Display */}
					{error && (
						<div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20">
							<div className="flex">
								<div className="flex-shrink-0">
									<IconXboxX className="h-5 w-5 text-destructive" />
								</div>
								<div className="ml-3">
									<p className="text-sm text-destructive">{error}</p>
								</div>
							</div>
						</div>
					)}

					<LabelInputContainer className="mb-4">
						<Label htmlFor="email">{t("auth.email")}</Label>
						<Input
							id="email"
							name="email"
							placeholder="your@email.com"
							type="email"
							autoComplete="email"
							required
							disabled={isLoading}
						/>
					</LabelInputContainer>

					<LabelInputContainer className="mb-4">
						<Label htmlFor="password">{t("auth.password")}</Label>
						<Input
							id="password"
							name="password"
							placeholder="••••••••"
							type="password"
							autoComplete="new-password"
							required
							disabled={isLoading}
						/>
					</LabelInputContainer>

					<LabelInputContainer className="mb-4">
						<Label htmlFor="confirmPassword">{t("auth.confirm_password")}</Label>
						<Input
							id="confirmPassword"
							name="confirmPassword"
							placeholder="••••••••"
							type="password"
							autoComplete="new-password"
							required
							disabled={isLoading}
						/>
					</LabelInputContainer>

					{passwordError && <div className="mb-4 text-sm text-status-error">{passwordError}</div>}

					<Button variant="primary" type="submit" disabled={isLoading} className="w-full">
						{isLoading ? t("auth.creating_account") : t("auth.sign_up_btn")}
					</Button>
				</form>

				{/* Sign in link */}
				<div className="text-center pt-4 border-t border-border">
					<span className="text-sm text-muted-foreground">
						{t("auth.has_account")}{" "}
						<Link
							to="/login"
							className="font-medium text-brand hover:text-brand/80 transition-colors"
						>
							{t("common.login")}
						</Link>
					</span>
				</div>
			</div>
		</FormContainer>
	);
}
