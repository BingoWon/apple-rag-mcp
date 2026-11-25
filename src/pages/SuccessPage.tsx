import { IconCircleCheck, IconReceipt } from "@tabler/icons-react";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { JevText } from "@/components/effects/jev-brand";
import { Button } from "@/components/ui/Button";

function SuccessContent() {
	const { t } = useTranslation();

	return (
		<div className="min-h-screen bg-background flex items-center justify-center px-4">
			<div className="max-w-md w-full text-center">
				<div className="mb-8">
					<IconReceipt className="w-16 h-16 text-brand mx-auto mb-4" />
					<h1 className="text-3xl font-bold text-foreground mb-2">{t("success.title")}</h1>
					<p className="text-subtle">{t("success.subtitle")}</p>
				</div>

				<div className="bg-card border border-border rounded-lg p-6 mb-8">
					<h2 className="text-lg font-semibold text-foreground mb-3">
						{t("success.pro_features")}
					</h2>
					<ul className="text-left space-y-2 text-subtle">
						<li className="flex items-center">
							<IconCircleCheck className="w-4 h-4 text-success mr-2 flex-shrink-0" />
							{t("success.feature_queries")}
						</li>
						<li className="flex items-center">
							<IconCircleCheck className="w-4 h-4 text-success mr-2 flex-shrink-0" />
							{t("success.feature_rpm")}
						</li>
						<li className="flex items-center">
							<IconCircleCheck className="w-4 h-4 text-success mr-2 flex-shrink-0" />
							<span>
								<JevText i18nKey="success.feature_rag" />
							</span>
						</li>
						<li className="flex items-center">
							<IconCircleCheck className="w-4 h-4 text-success mr-2 flex-shrink-0" />
							{t("success.feature_analytics")}
						</li>
					</ul>
				</div>

				<div className="space-y-3">
					<Button className="w-full" asChild>
						<Link to="/billing">{t("success.view_billing")}</Link>
					</Button>
					<Button variant="outline" className="w-full" asChild>
						<Link to="/">{t("success.back_home")}</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}

export default function SuccessPage() {
	return (
		<Suspense fallback={<div></div>}>
			<SuccessContent />
		</Suspense>
	);
}
