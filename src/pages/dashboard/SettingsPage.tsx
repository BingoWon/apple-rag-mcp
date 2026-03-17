import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { PasswordManagement } from "@/components/settings/PasswordManagement";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";

const profileSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function SettingsPage() {
	const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
	const { user, updateUser } = useAuth();

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
				toast.success("Profile updated\nYour profile has been updated successfully.");
			} else {
				throw new Error(response.error?.message || "Failed to update profile");
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to update profile. Please try again.";
			toast.error(`Error\n${errorMessage}`);
		} finally {
			setIsUpdatingProfile(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-light">Account Settings</h1>
				<p className="mt-1 text-sm text-muted">Manage your account information and preferences</p>
			</div>

			{/* Profile Settings */}
			<Card>
				<CardHeader>
					<CardTitle>Profile Information</CardTitle>
					<CardDescription>Update your personal information and email address</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
						<Input
							label="Full Name"
							{...profileForm.register("name")}
							error={profileForm.formState.errors.name?.message}
						/>

						{/* Email display (disabled input style) */}
						<div>
							<label htmlFor="email" className="block text-sm font-medium text-light mb-1">
								Email Address
							</label>
							<input
								id="email"
								type="email"
								value={user?.email || ""}
								disabled
								className="w-full px-3 py-2 bg-secondary border border-default rounded-md text-sm text-faint cursor-not-allowed"
								readOnly
							/>
							<p className="text-xs text-faint mt-1">
								Email cannot be changed for security reasons
							</p>
						</div>
						<Button
							type="submit"
							loading={isUpdatingProfile}
							disabled={!profileForm.formState.isDirty}
							className="w-auto"
						>
							Update Profile
						</Button>
					</form>
				</CardContent>
			</Card>

			{/* Password Management */}
			<PasswordManagement />

			{/* Delete Account */}
			<DeleteAccount />
		</div>
	);
}
