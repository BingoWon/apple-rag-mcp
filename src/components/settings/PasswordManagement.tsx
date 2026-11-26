import { IconLock } from "@tabler/icons-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { LoaderFive } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { type FieldErrors, validateWithSchema } from "@/lib/form";
import { useAuthStore } from "@/stores/auth";

interface AuthStatus {
	provider: string;
	canChangePassword: boolean;
	authenticationMethod: string;
}

interface PasswordChangeFields extends Record<string, string> {
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;
}

const INITIAL_FIELDS: PasswordChangeFields = {
	currentPassword: "",
	newPassword: "",
	confirmPassword: "",
};

const PROVIDER_METHOD_KEYS: Record<string, string> = {
	email: "settings.auth_method_email",
	google: "settings.auth_method_google",
	github: "settings.auth_method_github",
};

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

	const [fields, setFields] = useState<PasswordChangeFields>(INITIAL_FIELDS);
	const [errors, setErrors] = useState<FieldErrors<PasswordChangeFields>>({});
	const [isLoading, setIsLoading] = useState(false);
	const [isLoadingStatus, setIsLoadingStatus] = useState(true);
	const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);

	const updateField = (key: keyof PasswordChangeFields, value: string) => {
		setFields((prev) => ({ ...prev, [key]: value }));
		if (errors[key]) {
			setErrors((prev) => ({ ...prev, [key]: undefined }));
		}
	};

	const fetchAuthStatus = useCallback(async () => {
		setIsLoadingStatus(true);
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
	}, []);

	useEffect(() => {
		fetchAuthStatus();
	}, [fetchAuthStatus]);

	const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const result = validateWithSchema(passwordChangeSchema, fields);
		if (!result.ok) {
			setErrors(result.errors);
			return;
		}
		setErrors({});
		setIsLoading(true);
		try {
			const response = await api.changePassword(
				result.data.currentPassword,
				result.data.newPassword,
			);

			if (response.success) {
				toast.success(t("settings.password_changed"));
				setFields(INITIAL_FIELDS);
				useAuthStore.getState().clearSession();
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
				<CardContent className="flex flex-wrap items-center justify-between gap-3">
					<p className="text-sm text-subtle">{t("settings.auth_load_retry")}</p>
					<Button variant="outline" size="sm" onClick={() => void fetchAuthStatus()}>
						{t("common.retry")}
					</Button>
				</CardContent>
			</Card>
		);
	}

	const localizedMethod = t(PROVIDER_METHOD_KEYS[authStatus.provider] ?? "", {
		defaultValue: authStatus.authenticationMethod,
	});

	if (authStatus.canChangePassword) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{t("settings.change_password")}</CardTitle>
					<CardDescription>
						{t("settings.change_password_desc", { method: localizedMethod })}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form name="change-password" onSubmit={handlePasswordChange} className="space-y-4">
						<div>
							<label
								htmlFor="currentPassword"
								className="block text-sm font-medium text-foreground mb-1"
							>
								{t("settings.current_password")}
							</label>
							<Input
								id="currentPassword"
								type="password"
								placeholder={t("settings.current_password_placeholder")}
								autoComplete="current-password"
								value={fields.currentPassword}
								onChange={(event) => updateField("currentPassword", event.target.value)}
								error={errors.currentPassword}
							/>
						</div>

						<div>
							<label
								htmlFor="newPassword"
								className="block text-sm font-medium text-foreground mb-1"
							>
								{t("settings.new_password")}
							</label>
							<Input
								id="newPassword"
								type="password"
								placeholder={t("settings.new_password_placeholder")}
								autoComplete="new-password"
								value={fields.newPassword}
								onChange={(event) => updateField("newPassword", event.target.value)}
								error={errors.newPassword}
							/>
						</div>

						<div>
							<label
								htmlFor="confirmPassword"
								className="block text-sm font-medium text-foreground mb-1"
							>
								{t("settings.confirm_password")}
							</label>
							<Input
								id="confirmPassword"
								type="password"
								placeholder={t("settings.confirm_password_placeholder")}
								autoComplete="new-password"
								value={fields.confirmPassword}
								onChange={(event) => updateField("confirmPassword", event.target.value)}
								error={errors.confirmPassword}
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

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("settings.auth_method_title")}</CardTitle>
				<CardDescription>
					{t("settings.auth_method_desc", { method: localizedMethod })}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="p-4 bg-brand/10 rounded-lg border border-brand/25">
					<p className="text-sm text-brand flex items-center gap-2 font-medium">
						<IconLock className="h-4 w-4 shrink-0" aria-hidden="true" />
						<span>{t("settings.auth_managed", { method: localizedMethod })}</span>
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
