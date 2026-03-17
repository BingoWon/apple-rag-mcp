import { IconBrandGithub, IconBrandGoogle, IconXboxX } from "@tabler/icons-react";
import type React from "react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { FormContainer } from "@/components/ui/FormContainer";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { LabelInputContainer } from "@/components/ui/LabelInputContainer";
import { useAuth } from "@/hooks/useAuth";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { trackEvent } from "@/lib/analytics";
import { api } from "@/lib/api";
import { normalizeEmail } from "@/utils/email";

export function LoginForm() {
	const [isLoading, setIsLoading] = useState(false);
	const [oauthLoading, setOauthLoading] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { login } = useAuth();
	const { handleError } = useErrorHandler();

	// Check for error parameter in URL and show toast
	useEffect(() => {
		const urlError = searchParams.get("error");
		if (urlError) {
			// Decode the URL-encoded error message
			const decodedError = decodeURIComponent(urlError);
			toast.error(decodedError);

			// Clean up the URL by removing the error parameter
			const newUrl = new URL(window.location.href);
			newUrl.searchParams.delete("error");
			window.history.replaceState({}, "", newUrl.toString());
		}
	}, [searchParams]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsLoading(true);
		setError(null); // Clear previous errors

		const formData = new FormData(e.currentTarget);
		const email = normalizeEmail(formData.get("email") as string);
		const password = formData.get("password") as string;

		try {
			// Persistent debugging
			const debugLog = (message: string, data?: any) => {
				const timestamp = new Date().toISOString();
				const logEntry = `[${timestamp}] LoginForm: ${message}`;
				console.log(logEntry, data || "");

				try {
					// Store in localStorage for maximum persistence
					const existingLogs = localStorage.getItem("debug_loginform") || "";
					const newLog = `${logEntry} ${data ? JSON.stringify(data) : ""}\n`;
					localStorage.setItem("debug_loginform", existingLogs + newLog);

					// Also store in a combined debug log
					const allLogs = localStorage.getItem("debug_all") || "";
					localStorage.setItem("debug_all", allLogs + newLog);
				} catch (e) {
					console.error("Failed to store debug log:", e);
				}
			};

			debugLog("Login attempt started", { email });

			await login({
				email,
				password,
			});

			debugLog("Login completed successfully");

			// Track successful login
			trackEvent("USER_LOGIN", {
				method: "email",
				user_email: email,
			});

			// Wait for state synchronization before navigation
			debugLog("Waiting for state synchronization (150ms)");
			await new Promise((resolve) => setTimeout(resolve, 150));

			debugLog("Navigating to overview page");
			navigate("/overview/", { replace: true });
		} catch (error) {
			// Use unified error handling
			const friendlyError = handleError(error, {
				showToast: false, // Don't show toast, display in form instead
				title: "Login Failed",
			});

			setError(friendlyError.message);
		} finally {
			setIsLoading(false);
		}
	};

	const handleOAuthLogin = async (provider: "google" | "github") => {
		setOauthLoading(provider);

		// Track OAuth login attempt
		trackEvent("USER_LOGIN", {
			method: provider,
			login_type: "oauth",
		});

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
			toast.error(`Authentication failed\nFailed to initiate ${provider} login. Please try again.`);
			setOauthLoading(null);
		}
	};

	return (
		<FormContainer title="Welcome back" subtitle="Choose your preferred way to sign in">
			<div className="space-y-6">
				{/* OAuth Login Buttons - Top Priority */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<Button
						variant="outline"
						onClick={() => handleOAuthLogin("google")}
						disabled={oauthLoading !== null || isLoading}
						className="w-full h-11"
					>
						<IconBrandGoogle className="h-5 w-5 mr-3" />
						{oauthLoading === "google" ? "Connecting..." : "Google"}
					</Button>
					<Button
						variant="ghost"
						onClick={() => handleOAuthLogin("github")}
						disabled={oauthLoading !== null || isLoading}
						className="w-full h-11"
					>
						<IconBrandGithub className="h-5 w-5 mr-3" />
						{oauthLoading === "github" ? "Connecting..." : "GitHub"}
					</Button>
				</div>

				{/* Divider */}
				<div className="relative">
					<div className="absolute inset-0 flex items-center">
						<div className="w-full border-t border-border" />
					</div>
					<div className="relative flex justify-center text-xs uppercase">
						<span className="bg-card px-3 text-muted-foreground font-medium">
							Or continue with email
						</span>
					</div>
				</div>

				{/* Email/Password Form */}
				<form name="login" onSubmit={handleSubmit}>
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
						<Label htmlFor="email">Email Address</Label>
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
						<Label htmlFor="password">Password</Label>
						<Input
							id="password"
							name="password"
							placeholder="••••••••"
							type="password"
							autoComplete="current-password"
							required
							disabled={isLoading}
						/>
					</LabelInputContainer>

					{/* Forgot Password Link */}
					<div className="flex justify-end">
						<Link
							to="/forgot-password"
							className="text-sm text-brand hover:text-brand/80 transition-colors"
						>
							Forgot your password?
						</Link>
					</div>

					<Button variant="primary" type="submit" disabled={isLoading} className="w-full">
						{isLoading ? "Signing in..." : "Sign in →"}
					</Button>
				</form>

				{/* Sign up link */}
				<div className="text-center pt-4 border-t border-border">
					<span className="text-sm text-muted-foreground">
						Don&apos;t have an account?{" "}
						<Link
							to="/register"
							className="font-medium text-brand hover:text-brand/80 transition-colors"
						>
							Sign up
						</Link>
					</span>
				</div>
			</div>
		</FormContainer>
	);
}
