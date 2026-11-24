import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { normalizeEmail } from "@/utils/email";
import { getFriendlyErrorMessage } from "@/utils/errorMessages";

const forgotPasswordSchema = z.object({ email: z.string().email() });

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
	const { t } = useTranslation();
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
			const res = await api.forgotPassword(normalizedEmail);
			if (!res.success) {
				throw new Error(res.error?.message || t("forgot.failed"));
			}
			setIsSubmitted(true);
			toast.success(t("forgot.sent"));
		} catch (error) {
			// 提取错误信息并转换为友好提示
			let errorMessage: string;
			if (error instanceof Error) {
				errorMessage = error.message;
			} else {
				errorMessage = t("forgot.failed");
			}

			const friendlyMessage = getFriendlyErrorMessage(undefined, errorMessage);
			toast.error(`${t("forgot.failed")}\n${friendlyMessage}`);
		} finally {
			setIsLoading(false);
		}
	};

	if (isSubmitted) {
		return (
			<div className="text-center">
				<h1 className="auth-title">{t("forgot.sent_title")}</h1>
				<p className="text-muted-foreground mb-6">
					{t("forgot.sent_description")}
					<br />
					<span className="font-medium">{getValues("email")}</span>
				</p>
				<p className="text-sm text-muted-foreground mb-6">{t("forgot.retry_note")}</p>
				<div className="space-y-4">
					<Button onClick={() => setIsSubmitted(false)} variant="primary" className="w-full">
						{t("common.retry")}
					</Button>
					<div className="text-center">
						<Link to="/login" className="text-sm font-medium text-brand hover:text-brand/80">
							{t("auth.back_to_signin")}
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			<div>
				<h1 className="auth-title">{t("forgot.title")}</h1>
				<p className="text-muted-foreground text-center mb-6">{t("forgot.description")}</p>
			</div>

			<Input
				label={t("auth.email")}
				type="email"
				autoComplete="email"
				required
				{...register("email")}
				error={errors.email ? t("forgot.invalid_email") : undefined}
			/>

			<Button
				type="submit"
				variant="primary"
				className="w-full"
				loading={isLoading}
				disabled={isLoading}
			>
				{t("forgot.send")}
			</Button>

			<div className="text-center">
				<Link to="/login" className="text-sm font-medium text-brand hover:text-brand/80">
					{t("auth.back_to_signin")}
				</Link>
			</div>
		</form>
	);
}
