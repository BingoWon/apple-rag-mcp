import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { LoaderFive } from "@/components/ui/loader";
import { api } from "@/lib/api";

interface AuthStatus {
	provider: string;
	canChangePassword: boolean;
	authenticationMethod: string;
}

export function PasswordManagement() {
	const { t } = useTranslation();
	const passwordChangeSchema = z
		.object({
			currentPassword: z.string().min(1, t("settings.current_required")),
			newPassword: z.string().min(8, t("settings.password_min")),
			confirmPassword: z.string(),
		})
		.refine((data) => data.newPassword === data.confirmPassword, {
			message: t("settings.passwords_mismatch"),
			path: ["confirmPassword"],
		});
	type PasswordChangeData = z.infer<typeof passwordChangeSchema>;

	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingStatus, setIsLoadingStatus] = useState(true);
	const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);

	const changeForm = useForm<PasswordChangeData>({
		resolver: zodResolver(passwordChangeSchema),
	});

	// Fetch authentication status on component mount
	useEffect(() => {
		const fetchAuthStatus = async () => {
			try {
				const response = await api.getAuthStatus();
				if (response.success && response.data) {
					setAuthStatus(response.data as AuthStatus);
				}
			} catch (error) {
				console.error("Failed to fetch auth status:", error);
			} finally {
				setIsLoadingStatus(false);
			}
		};

		fetchAuthStatus();
	}, []);

	const handlePasswordChange = async (data: PasswordChangeData) => {
		setIsLoading(true);
		try {
			const response = await api.changePassword(data.currentPassword, data.newPassword);

			if (response.success) {
				toast.success(t("settings.password_changed"));
				changeForm.reset();

				// Refresh auth status
				const statusResponse = await api.getAuthStatus();
				if (statusResponse.success && statusResponse.data) {
					setAuthStatus(statusResponse.data as AuthStatus);
				}
			} else {
				throw new Error(response.error?.message || t("settings.password_change_error"));
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : t("settings.password_change_error");
			toast.error(`${t("common.error")}\n${errorMessage}`);
		} finally {
			setIsLoading(false);
		}
	};

	if (isLoadingStatus) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{t("settings.password_title")}</CardTitle>
					<CardDescription>{t("settings.loading_auth")}</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center py-8">
						<LoaderFive text={t("common.loading")} />
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!authStatus) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{t("settings.password_title")}</CardTitle>
					<CardDescription>{t("settings.auth_load_error")}</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-gray-500">{t("settings.auth_load_retry")}</p>
				</CardContent>
			</Card>
		);
	}

	// Email users can change password - OAuth users cannot
	if (authStatus.canChangePassword) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{t("settings.change_password")}</CardTitle>
					<CardDescription>
						{t("settings.change_password_desc", { method: authStatus.authenticationMethod })}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						name="change-password"
						onSubmit={changeForm.handleSubmit(handlePasswordChange)}
						className="space-y-4"
					>
						<div>
							<label
								htmlFor="currentPassword"
								className="block text-sm font-medium text-text-primary mb-1"
							>
								{t("settings.current_password")}
							</label>
							<Input
								id="currentPassword"
								type="password"
								placeholder={t("settings.current_password_placeholder")}
								autoComplete="current-password"
								{...changeForm.register("currentPassword")}
								error={changeForm.formState.errors.currentPassword?.message}
							/>
						</div>

						<div>
							<label
								htmlFor="newPassword"
								className="block text-sm font-medium text-text-primary mb-1"
							>
								{t("settings.new_password")}
							</label>
							<Input
								id="newPassword"
								type="password"
								placeholder={t("settings.new_password_placeholder")}
								autoComplete="new-password"
								{...changeForm.register("newPassword")}
								error={changeForm.formState.errors.newPassword?.message}
							/>
						</div>

						<div>
							<label
								htmlFor="confirmPassword"
								className="block text-sm font-medium text-text-primary mb-1"
							>
								{t("settings.confirm_password")}
							</label>
							<Input
								id="confirmPassword"
								type="password"
								placeholder={t("settings.confirm_password_placeholder")}
								autoComplete="new-password"
								{...changeForm.register("confirmPassword")}
								error={changeForm.formState.errors.confirmPassword?.message}
							/>
						</div>

						<Button type="submit" disabled={isLoading} className="w-auto">
							{isLoading ? t("settings.changing_password") : t("settings.change_password")}
						</Button>
					</form>
				</CardContent>
			</Card>
		);
	}

	// OAuth users - show information about their authentication method
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("settings.auth_method_title")}</CardTitle>
				<CardDescription>
					{t("settings.auth_method_desc", { method: authStatus.authenticationMethod })}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="p-4 bg-brand/10 rounded-lg">
					<p className="text-sm text-brand">
						🔐 {t("settings.auth_managed", { method: authStatus.authenticationMethod })}
					</p>
					{authStatus.provider === "google" && (
						<p className="text-sm text-brand/80 mt-2">{t("settings.google_manage")}</p>
					)}
					{authStatus.provider === "github" && (
						<p className="text-sm text-brand/80 mt-2">{t("settings.github_manage")}</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
