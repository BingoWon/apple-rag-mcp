import { IconInfoCircle, IconSquareRoundedPlus } from "@tabler/icons-react";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { MCPTokensList } from "@/components/dashboard/MCPTokensList";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useDashboardStore } from "@/stores/dashboard";

export default function MCPTokensPage() {
	const { t } = useTranslation();
	const { mcpTokens, fetchMCPTokens, createMCPToken, isLoadingTokens } = useDashboardStore();

	useEffect(() => {
		fetchMCPTokens();
	}, [fetchMCPTokens]);

	const handleCreateToken = async () => {
		if (mcpTokens.length >= 10) {
			toast.error(t("tokens.max_reached"));
			return;
		}

		try {
			const tokenName = `MCP Token ${new Date().toLocaleDateString()}`;
			const result = await createMCPToken({
				name: tokenName,
				permissions: ["rag.read"], // Fixed permission, user doesn't need to know
			});

			if (result) {
				toast.success(t("tokens.created_success", { name: tokenName }));
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t("tokens.create_error"));
		}
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-light">{t("tokens.title")}</h1>
				<p className="mt-1 text-sm text-muted">{t("tokens.subtitle")}</p>
			</div>

			{/* Usage Info */}
			<Card>
				<CardContent className="p-4">
					<div className="flex">
						<div className="flex-shrink-0">
							<IconInfoCircle className="h-5 w-5 text-info" />
						</div>
						<div className="ml-3">
							<h3 className="text-sm font-medium text-light">{t("tokens.security_title")}</h3>
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
					<div className="flex items-center justify-between">
						<CardTitle>{t("tokens.your_tokens", { count: mcpTokens.length })}</CardTitle>
						<Button onClick={handleCreateToken} variant="primary" disabled={mcpTokens.length >= 10}>
							<IconSquareRoundedPlus className="h-4 w-4 mr-2" />
							{t("tokens.create")}
						</Button>
					</div>
				</CardHeader>
				<CardContent className="p-0">
					<MCPTokensList
						tokens={mcpTokens}
						onRefresh={fetchMCPTokens}
						isLoading={isLoadingTokens}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
