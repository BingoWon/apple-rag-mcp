import { IconCheck, IconEye, IconEyeOff } from "@tabler/icons-react";
import type React from "react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
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
	const { t } = useTranslation();

	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	// Redirect if no token
	useEffect(() => {
		if (!token) {
			toast.error(t("auth.invalid_token"));
			navigate("/forgot-password");
		}
	}, [token, navigate]);

	const validatePassword = (password: string) => {
		if (password.length < 8) {
			return t("auth.password_min_length");
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
			toast.error(t("auth.passwords_mismatch"));
			setIsLoading(false);
			return;
		}

		if (!token) {
			toast.error(t("auth.invalid_token"));
			setIsLoading(false);
			return;
		}

		try {
			const result = await resetPassword(token, password);

			if (result.success) {
				setSuccess(true);
				toast.success(t("auth.reset_success"));

				// Redirect to login after 2 seconds
				setTimeout(() => {
					navigate("/login");
				}, 2000);
			} else {
				toast.error(result.error?.message || t("auth.reset_failed"));
			}
		} catch (_error) {
			toast.error(t("auth.unexpected_error"));
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
				title={t("auth.reset_complete_title")}
				subtitle={t("auth.reset_complete_subtitle")}
			>
				<div className="space-y-6 text-center">
					<div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
						<IconCheck className="w-8 h-8 text-success" />
					</div>

					<p className="text-muted-foreground">{t("auth.reset_redirect")}</p>

					<Link to="/login">
						<Button variant="primary" className="w-full">
							{t("auth.continue_signin")}
						</Button>
					</Link>
				</div>
			</FormContainer>
		);
	}

	return (
		<FormContainer title={t("auth.reset_title")} subtitle={t("auth.reset_subtitle")}>
			<form name="reset-password" onSubmit={handleSubmit} className="space-y-6">
				<LabelInputContainer>
					<Label htmlFor="password">{t("auth.new_password")}</Label>
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
					<p className="text-sm text-muted-foreground">{t("auth.password_min_length")}</p>
				</LabelInputContainer>

				<LabelInputContainer>
					<Label htmlFor="confirmPassword">{t("auth.confirm_new_password")}</Label>
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
					{isLoading ? t("auth.resetting") : t("auth.reset_btn")}
				</Button>

				{/* Back to Login Link */}
				<div className="text-center">
					<Link
						to="/login"
						className="text-sm font-medium text-brand hover:text-brand/80 transition-colors"
					>
						{t("auth.back_to_signin")}
					</Link>
				</div>
			</form>
		</FormContainer>
	);
}
