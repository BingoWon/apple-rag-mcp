import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/forms/ResetPasswordForm";
import { LoaderFive } from "@/components/ui/loader";

export default function ResetPasswordPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center">
					<LoaderFive text="Loading reset form..." />
				</div>
			}
		>
			<ResetPasswordForm />
		</Suspense>
	);
}
