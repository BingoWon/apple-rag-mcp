import { IconInfoCircle, IconSquareRoundedPlus } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { MCPTokensList } from "@/components/dashboard/MCPTokensList";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDateOnly } from "@/lib/datetime";
import { useDashboardStore } from "@/stores/dashboard";

export default function MCPTokensPage() {
	const { t, i18n } = useTranslation();
	const { mcpTokens, fetchMCPTokens, createMCPToken, isLoadingTokens, errors } =
		useDashboardStore();
	const [isCreating, setIsCreating] = useState(false);

	useEffect(() => {
		fetchMCPTokens();
	}, [fetchMCPTokens]);

	const handleCreateToken = async () => {
		if (isCreating) return;
		if (mcpTokens.length >= 10) {
			toast.error(t("tokens.max_reached"));
			return;
		}

		setIsCreating(true);
		try {
			const tokenName = t("tokens.default_name", {
				date: formatDateOnly(new Date(), i18n.resolvedLanguage),
			});
			const result = await createMCPToken({
				name: tokenName,
				permissions: ["rag.read"], // Fixed permission, user doesn't need to know
			});

			if (result) {
				toast.success(t("tokens.created_success", { name: tokenName }));
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t("tokens.create_error"));
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-foreground">{t("tokens.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("tokens.subtitle")}</p>
			</div>

			{/* Usage Info */}
			<Card>
				<CardContent className="p-4">
					<div className="flex">
						<div className="flex-shrink-0">
							<IconInfoCircle className="h-5 w-5 text-brand" />
						</div>
						<div className="ml-3">
							<h3 className="text-sm font-medium text-foreground">{t("tokens.security_title")}</h3>
							<div className="mt-2 text-sm text-muted">
								<p>{t("tokens.security_desc")}</p>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* MCP Tokens List */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between gap-3">
						<CardTitle>{t("tokens.your_tokens", { count: mcpTokens.length })}</CardTitle>
						<Button
							onClick={handleCreateToken}
							variant="primary"
							loading={isCreating}
							disabled={isCreating || mcpTokens.length >= 10}
						>
							<IconSquareRoundedPlus className="h-4 w-4 mr-2" />
							{t("tokens.create")}
						</Button>
					</div>
				</CardHeader>
				<CardContent className="p-0">
					{errors.tokens && mcpTokens.length === 0 ? (
						<div
							role="alert"
							className="flex flex-wrap items-center justify-between gap-3 p-6 text-sm"
						>
							<span className="text-destructive">{errors.tokens}</span>
							<Button variant="outline" size="sm" onClick={() => void fetchMCPTokens()}>
								{t("common.retry")}
							</Button>
						</div>
					) : (
						<MCPTokensList
							tokens={mcpTokens}
							onRefresh={fetchMCPTokens}
							isLoading={isLoadingTokens}
						/>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
