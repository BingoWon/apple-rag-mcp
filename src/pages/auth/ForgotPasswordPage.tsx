import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { normalizeEmail } from "@/utils/email";
import { getFriendlyErrorMessage } from "@/utils/errorMessages";

const forgotPasswordSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
	const [isLoading, setIsLoading] = useState(false);
	const [isSubmitted, setIsSubmitted] = useState(false);

	const {
		register,
		handleSubmit,
		formState: { errors },
		getValues,
	} = useForm<ForgotPasswordFormData>({
		resolver: zodResolver(forgotPasswordSchema),
	});

	const onSubmit = async (data: ForgotPasswordFormData) => {
		setIsLoading(true);

		try {
			const normalizedEmail = normalizeEmail(data.email);
			await api.forgotPassword(normalizedEmail);
			setIsSubmitted(true);
			toast.success("Reset link sent!\nCheck your email for password reset instructions.");
		} catch (error) {
			// 提取错误信息并转换为友好提示
			let errorMessage: string;
			if (error instanceof Error) {
				errorMessage = error.message;
			} else {
				errorMessage = "Failed to send reset email.";
			}

			const friendlyMessage = getFriendlyErrorMessage(undefined, errorMessage);
			toast.error(`Password Reset Failed\n${friendlyMessage}`);
		} finally {
			setIsLoading(false);
		}
	};

	if (isSubmitted) {
		return (
			<div className="text-center">
				<h2 className="text-2xl font-bold text-foreground mb-6">Check your email</h2>
				<p className="text-muted-foreground mb-6">
					We&apos;ve sent a password reset link to{" "}
					<span className="font-medium">{getValues("email")}</span>
				</p>
				<p className="text-sm text-muted-foreground mb-6">
					Didn&apos;t receive the email? Check your spam folder or try again.
				</p>
				<div className="space-y-4">
					<Button onClick={() => setIsSubmitted(false)} variant="primary" className="w-full">
						Try again
					</Button>
					<div className="text-center">
						<Link to="/login" className="text-sm font-medium text-brand hover:text-brand/80">
							Back to sign in
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			<div>
				<h2 className="text-2xl font-bold text-foreground text-center mb-6">
					Forgot your password?
				</h2>
				<p className="text-muted-foreground text-center mb-6">
					Enter your email address and we&apos;ll send you a link to reset your password.
				</p>
			</div>

			<Input
				label="Email address"
				type="email"
				autoComplete="email"
				required
				{...register("email")}
				error={errors.email?.message}
			/>

			<Button
				type="submit"
				variant="primary"
				className="w-full"
				loading={isLoading}
				disabled={isLoading}
			>
				Send reset link
			</Button>

			<div className="text-center">
				<Link to="/login" className="text-sm font-medium text-brand hover:text-brand/80">
					Back to sign in
				</Link>
			</div>
		</form>
	);
}
