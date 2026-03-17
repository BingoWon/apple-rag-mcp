import { IconCheck, IconEye, IconEyeOff } from "@tabler/icons-react";
import type React from "react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { FormContainer } from "@/components/ui/FormContainer";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { LabelInputContainer } from "@/components/ui/LabelInputContainer";
import { resetPassword } from "@/lib/api";

export function ResetPasswordForm() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const token = searchParams.get("token");

	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	// Redirect if no token
	useEffect(() => {
		if (!token) {
			toast.error("Invalid or missing reset token\nRedirecting to forgot password page...");
			navigate("/forgot-password");
		}
	}, [token, navigate]);

	const validatePassword = (password: string) => {
		if (password.length < 8) {
			return "Password must be at least 8 characters long";
		}
		return "";
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsLoading(true);

		// Validation
		const passwordError = validatePassword(password);
		if (passwordError) {
			toast.error(passwordError);
			setIsLoading(false);
			return;
		}

		if (password !== confirmPassword) {
			toast.error("Passwords don't match\nPlease ensure both passwords are identical.");
			setIsLoading(false);
			return;
		}

		if (!token) {
			toast.error("Invalid reset token\nPlease request a new password reset.");
			setIsLoading(false);
			return;
		}

		try {
			const result = await resetPassword(token, password);

			if (result.success) {
				setSuccess(true);
				toast.success("Password reset successfully!\nYou can now sign in with your new password.");

				// Redirect to login after 2 seconds
				setTimeout(() => {
					navigate("/login");
				}, 2000);
			} else {
				toast.error(
					result.error?.message ||
						"Failed to reset password\nPlease try again or request a new reset link.",
				);
			}
		} catch (_error) {
			toast.error("An unexpected error occurred\nPlease try again later.");
		} finally {
			setIsLoading(false);
		}
	};

	if (!token) {
		return null; // Will redirect
	}

	if (success) {
		return (
			<FormContainer
				title="Password Reset Complete"
				subtitle="Your password has been successfully updated"
			>
				<div className="space-y-6 text-center">
					<div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
						<IconCheck className="w-8 h-8 text-success" />
					</div>

					<p className="text-muted-foreground">
						You will be redirected to the login page shortly, or you can click below to continue.
					</p>

					<Link to="/login">
						<Button variant="primary" className="w-full">
							Continue to Sign In →
						</Button>
					</Link>
				</div>
			</FormContainer>
		);
	}

	return (
		<FormContainer title="Reset Your Password" subtitle="Enter your new password below">
			<form name="reset-password" onSubmit={handleSubmit} className="space-y-6">
				<LabelInputContainer>
					<Label htmlFor="password">New Password</Label>
					<div className="relative">
						<Input
							id="password"
							type={showPassword ? "text" : "password"}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							autoComplete="new-password"
							required
							disabled={isLoading}
							className="pr-10"
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => setShowPassword(!showPassword)}
							className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
						>
							{showPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
						</Button>
					</div>
					<p className="text-sm text-muted-foreground">
						Password must be at least 8 characters long
					</p>
				</LabelInputContainer>

				<LabelInputContainer>
					<Label htmlFor="confirmPassword">Confirm New Password</Label>
					<div className="relative">
						<Input
							id="confirmPassword"
							type={showConfirmPassword ? "text" : "password"}
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							placeholder="••••••••"
							autoComplete="new-password"
							required
							disabled={isLoading}
							className="pr-10"
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => setShowConfirmPassword(!showConfirmPassword)}
							className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
						>
							{showConfirmPassword ? (
								<IconEyeOff className="w-4 h-4" />
							) : (
								<IconEye className="w-4 h-4" />
							)}
						</Button>
					</div>
				</LabelInputContainer>

				<Button variant="primary" type="submit" disabled={isLoading} className="w-full">
					{isLoading ? "Resetting Password..." : "Reset Password →"}
				</Button>

				{/* Back to Login Link */}
				<div className="text-center">
					<Link
						to="/login"
						className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
					>
						Back to Sign In
					</Link>
				</div>
			</form>
		</FormContainer>
	);
}
