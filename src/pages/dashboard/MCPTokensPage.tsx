import { IconInfoCircle, IconSquareRoundedPlus } from "@tabler/icons-react";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { MCPTokensList } from "@/components/dashboard/MCPTokensList";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useDashboardStore } from "@/stores/dashboard";

export default function MCPTokensPage() {
	const { mcpTokens, fetchMCPTokens, createMCPToken, isLoadingTokens } = useDashboardStore();

	useEffect(() => {
		fetchMCPTokens();
	}, [fetchMCPTokens]);

	const handleCreateToken = async () => {
		if (mcpTokens.length >= 10) {
			toast.error("Maximum of 10 MCP tokens allowed");
			return;
		}

		try {
			const tokenName = `MCP Token ${new Date().toLocaleDateString()}`;
			const result = await createMCPToken({
				name: tokenName,
				permissions: ["rag.read"], // Fixed permission, user doesn't need to know
			});

			if (result) {
				toast.success(`MCP Token Created\n"${tokenName}" has been created successfully.`);
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Error\nFailed to create MCP token");
		}
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold text-light">MCP Tokens</h1>
				<p className="mt-1 text-sm text-muted">
					Manage your MCP tokens to authenticate requests to the Apple RAG MCP Server
				</p>
			</div>

			{/* Usage Info */}
			<Card>
				<CardContent className="p-4">
					<div className="flex">
						<div className="flex-shrink-0">
							<IconInfoCircle className="h-5 w-5 text-info" />
						</div>
						<div className="ml-3">
							<h3 className="text-sm font-medium text-light">MCP Token Security</h3>
							<div className="mt-2 text-sm text-muted">
								<p>
									Keep your MCP tokens secure and never share them publicly. Use these tokens to
									authenticate with the Apple RAG MCP Server.
								</p>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* MCP Tokens List */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Your MCP Tokens ({mcpTokens.length}/10)</CardTitle>
						<Button onClick={handleCreateToken} variant="primary" disabled={mcpTokens.length >= 10}>
							<IconSquareRoundedPlus className="h-4 w-4 mr-2" />
							Create MCP Token
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
