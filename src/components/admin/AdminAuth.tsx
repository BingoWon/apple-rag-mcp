/**
 * Admin Authentication Component
 * Password-protected access to admin dashboard
 */
import { IconEye, IconEyeOff, IconShieldCheck } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { api } from "@/lib/api";
import { ADMIN_SESSION_KEY } from "@/lib/constants";

interface AdminAuthProps {
	onAuthenticated: () => void;
}

export function AdminAuth({ onAuthenticated }: AdminAuthProps) {
	const { t } = useTranslation();
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const verifyStoredPassword = useCallback(
		async (_storedPassword: string) => {
			try {
				// Test the stored password using the zero-DB admin health endpoint
				await api.verifyAdminSession();
				onAuthenticated();
			} catch (_error) {
				// Invalid stored password, clear it
				localStorage.removeItem(ADMIN_SESSION_KEY);
			}
		},
		[onAuthenticated],
	);

	// Check if already authenticated
	useEffect(() => {
		const storedPassword = localStorage.getItem(ADMIN_SESSION_KEY);
		if (storedPassword) {
			// Verify stored password with backend
			verifyStoredPassword(storedPassword);
		}
	}, [
		// Verify stored password with backend
		verifyStoredPassword,
	]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		try {
			// Store password permanently for API call
			localStorage.setItem(ADMIN_SESSION_KEY, password);

			// Verify password against the zero-DB admin endpoint
			await api.verifyAdminSession();

			// If successful, authenticate
			onAuthenticated();
		} catch (error) {
			// Clear invalid password from storage
			localStorage.removeItem(ADMIN_SESSION_KEY);

			// Handle authentication error
			if (
				error &&
				typeof error === "object" &&
				"response" in error &&
				error.response &&
				typeof error.response === "object" &&
				"status" in error.response &&
				error.response.status === 401
			) {
				setError(t("admin.auth_invalid"));
			} else {
				setError(t("admin.auth_failed"));
			}
			setPassword("");
		}

		setIsLoading(false);
	};

	return (
		<div className="min-h-dvh bg-background flex items-center justify-center px-4 relative">
			{/* Theme Toggle in top right corner */}
			<div className="absolute top-4 right-4">
				<ThemeToggle />
			</div>

			<div className="max-w-md w-full space-y-8">
				{/* Header */}
				<div className="text-center">
					<div className="mx-auto h-16 w-16 bg-brand/15 rounded-full flex items-center justify-center">
						<IconShieldCheck className="h-8 w-8 text-brand" />
					</div>
					<h2 className="mt-6 text-3xl font-bold text-foreground">{t("admin.auth_title")}</h2>
					<p className="mt-2 text-subtle">{t("admin.auth_subtitle")}</p>
				</div>

				{/* Form */}
				<form name="admin-login" className="mt-8 space-y-6" onSubmit={handleSubmit}>
					<div>
						<label htmlFor="password" className="sr-only">
							{t("admin.auth_password")}
						</label>
						<div className="relative">
							<input
								id="password"
								name="password"
								type={showPassword ? "text" : "password"}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="relative block w-full px-3 py-3 border border-border bg-surface text-foreground placeholder:text-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand pr-10"
								placeholder={t("admin.auth_placeholder")}
								autoComplete="current-password"
								required
								disabled={isLoading}
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								aria-label={showPassword ? t("auth.hide_password") : t("auth.show_password")}
								className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 text-subtle hover:text-foreground"
								onClick={() => setShowPassword(!showPassword)}
								disabled={isLoading}
							>
								{showPassword ? (
									<IconEyeOff className="h-5 w-5" />
								) : (
									<IconEye className="h-5 w-5" />
								)}
							</Button>
						</div>
					</div>

					{error && (
						<div className="text-destructive text-sm text-center bg-destructive/10 border border-destructive/30 rounded-lg p-3">
							{error}
						</div>
					)}

					<Button
						type="submit"
						variant="primary"
						disabled={isLoading || !password}
						className="w-full"
						loading={isLoading}
					>
						{isLoading ? t("admin.auth_verifying") : t("admin.auth_submit")}
					</Button>
				</form>

				{/* Footer */}
				<div className="text-center">
					<p className="text-xs text-subtle">{t("admin.auth_notice")}</p>
				</div>
			</div>
		</div>
	);
}
