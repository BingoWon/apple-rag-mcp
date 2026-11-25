import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { z } from "zod";
import { CLIAccess } from "@/components/settings/CLIAccess";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { PasswordManagement } from "@/components/settings/PasswordManagement";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";

export default function SettingsPage() {
	const { t } = useTranslation();
	const { hash } = useLocation();
	const profileSchema = z.object({
		name: z.string().trim().min(2, t("settings.name_min")).max(100, t("settings.name_max")),
	});
	type ProfileFormData = z.infer<typeof profileSchema>;

	const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
	const { user, updateUser } = useAuth();

	useEffect(() => {
		if (!hash) return;
		const id = hash.slice(1);
		const el = document.getElementById(id);
		if (el) {
			requestAnimationFrame(() => {
				el.scrollIntoView({ behavior: "smooth", block: "start" });
			});
		}
	}, [hash]);

	const profileForm = useForm<ProfileFormData>({
		resolver: zodResolver(profileSchema),
		defaultValues: {
			name: user?.name || "",
		},
	});

	const onProfileSubmit = async (data: ProfileFormData) => {
		setIsUpdatingProfile(true);
		try {
			const response = await api.updateUserProfile(data);

			if (response.success && response.data) {
				updateUser(response.data);
				profileForm.reset({ name: response.data.name || data.name });
				toast.success(t("settings.profile_updated"));
			} else {
				throw new Error(response.error?.message || t("settings.profile_error"));
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : t("settings.profile_error");
			toast.error(`${t("common.error")}\n${errorMessage}`);
		} finally {
			setIsUpdatingProfile(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-foreground">{t("settings.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("settings.subtitle")}</p>
			</div>

			{/* Profile Settings */}
			<Card>
				<CardHeader>
					<CardTitle>{t("settings.profile_title")}</CardTitle>
					<CardDescription>{t("settings.profile_desc")}</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
						<Input
							label={t("settings.full_name")}
							{...profileForm.register("name")}
							error={profileForm.formState.errors.name?.message}
						/>

						{/* Email display (disabled input style) */}
						<div>
							<label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
								{t("settings.email_label")}
							</label>
							<input
								id="email"
								type="email"
								value={user?.email || ""}
								disabled
								className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm text-subtle cursor-not-allowed"
								readOnly
							/>
							<p className="text-xs text-subtle mt-1">{t("settings.email_locked")}</p>
						</div>
						<Button
							type="submit"
							loading={isUpdatingProfile}
							disabled={!profileForm.formState.isDirty}
							className="w-auto"
						>
							{t("settings.update_profile")}
						</Button>
					</form>
				</CardContent>
			</Card>

			<CLIAccess />

			{/* Password Management */}
			<PasswordManagement />

			{/* Delete Account */}
			<DeleteAccount />
		</div>
	);
}
