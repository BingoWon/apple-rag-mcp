import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { LoaderFive } from "@/components/ui/loader";
import { api } from "@/lib/api";

// Password change schema for email users only
const passwordChangeSchema = z
	.object({
		currentPassword: z.string().min(1, "Current password is required"),
		newPassword: z.string().min(8, "Password must be at least 8 characters"),
		confirmPassword: z.string(),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords don't match",
		path: ["confirmPassword"],
	});

type PasswordChangeData = z.infer<typeof passwordChangeSchema>;

interface AuthStatus {
	provider: string;
	canChangePassword: boolean;
	authenticationMethod: string;
}

export function PasswordManagement() {
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
				toast.success("Password changed successfully!\nYour password has been updated.");
				changeForm.reset();

				// Refresh auth status
				const statusResponse = await api.getAuthStatus();
				if (statusResponse.success && statusResponse.data) {
					setAuthStatus(statusResponse.data as AuthStatus);
				}
			} else {
				throw new Error(response.error?.message || "Failed to change password");
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to update password. Please try again.";
			toast.error(`Error\n${errorMessage}`);
		} finally {
			setIsLoading(false);
		}
	};

	if (isLoadingStatus) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Password Management</CardTitle>
					<CardDescription>Loading authentication settings...</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-center py-8">
						<LoaderFive text="Loading settings..." />
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!authStatus) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Password Management</CardTitle>
					<CardDescription>Unable to load authentication settings</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-gray-500">Please refresh the page to try again.</p>
				</CardContent>
			</Card>
		);
	}

	// Email users can change password - OAuth users cannot
	if (authStatus.canChangePassword) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Change Password</CardTitle>
					<CardDescription>
						Update your account password for {authStatus.authenticationMethod} authentication.
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
								Current Password
							</label>
							<Input
								id="currentPassword"
								type="password"
								placeholder="Enter your current password"
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
								New Password
							</label>
							<Input
								id="newPassword"
								type="password"
								placeholder="Enter your new password"
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
								Confirm New Password
							</label>
							<Input
								id="confirmPassword"
								type="password"
								placeholder="Confirm your new password"
								autoComplete="new-password"
								{...changeForm.register("confirmPassword")}
								error={changeForm.formState.errors.confirmPassword?.message}
							/>
						</div>

						<Button type="submit" disabled={isLoading} className="w-auto">
							{isLoading ? "Changing Password..." : "Change Password"}
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
				<CardTitle>Authentication Method</CardTitle>
				<CardDescription>
					Your account uses {authStatus.authenticationMethod} for secure sign-in.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="p-4 bg-brand/10 rounded-lg">
					<p className="text-sm text-brand">
						🔐 Your account is secured with {authStatus.authenticationMethod}. Password management
						is handled by your authentication provider.
					</p>
					{authStatus.provider === "google" && (
						<p className="text-sm text-brand/80 mt-2">
							To manage your password, visit your Google Account settings.
						</p>
					)}
					{authStatus.provider === "github" && (
						<p className="text-sm text-brand/80 mt-2">
							To manage your password, visit your GitHub Account settings.
						</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
