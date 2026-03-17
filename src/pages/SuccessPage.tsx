import { IconCircleCheck } from "@tabler/icons-react";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

function SuccessContent() {
	const { t } = useTranslation();

	return (
		<div className="min-h-screen bg-background flex items-center justify-center px-4">
			<div className="max-w-md w-full text-center">
				<div className="mb-8">
					<IconCircleCheck className="w-16 h-16 text-success mx-auto mb-4" />
					<h1 className="text-3xl font-bold text-foreground mb-2">{t("success.title")}</h1>
					<p className="text-muted-foreground">{t("success.subtitle")}</p>
				</div>

				<div className="bg-card border border-border rounded-lg p-6 mb-8">
					<h2 className="text-lg font-semibold text-foreground mb-3">{t("success.whats_next")}</h2>
					<ul className="text-left space-y-2 text-muted-foreground">
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
							{t("success.feature_rag")}
						</li>
						<li className="flex items-center">
							<IconCircleCheck className="w-4 h-4 text-success mr-2 flex-shrink-0" />
							{t("success.feature_analytics")}
						</li>
					</ul>
				</div>

				<div className="space-y-3">
					<Link to="/overview/" className="block">
						<Button className="w-full">{t("success.go_dashboard")}</Button>
					</Link>
					<Link to="/" className="block">
						<Button variant="outline" className="w-full">
							{t("success.back_home")}
						</Button>
					</Link>
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
