import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm";
import { LoaderFive } from "@/components/ui/loader";

export default function ResetPasswordPage() {
	const { t } = useTranslation();
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center">
					<LoaderFive text={t("common.loading")} />
				</div>
			}
		>
			<ResetPasswordForm />
		</Suspense>
	);
}
