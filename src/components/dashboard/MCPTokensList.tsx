import {
	IconClipboard,
	IconDots,
	IconEye,
	IconEyeOff,
	IconKey,
	IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { LoaderFive } from "@/components/ui/loader";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import { formatDate } from "@/lib/utils";
import { useDashboardStore } from "@/stores/dashboard";
import type { MCPToken } from "@/types";
import { MCPConfigService } from "@/utils/mcpConfigService";
import { copyMcpTokenToClipboard, getMcpTokenDisplayText } from "@/utils/mcpTokenUtils";
import { EditableName } from "./EditableName";

interface MCPTokensListProps {
	tokens: MCPToken[];
	onRefresh: () => void;
	isLoading?: boolean;
}

export function MCPTokensList({ tokens, onRefresh, isLoading = false }: MCPTokensListProps) {
	const { updateMCPToken, deleteMCPToken } = useDashboardStore();
	const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());

	const { handleDeleteClick, isDeleting, DeleteModal } = useDeleteConfirm({
		onDelete: deleteMCPToken,
		onRefresh,
		itemType: "MCP Token",
		title: "Delete MCP Token",
		successMessage: (name) => `MCP Token Deleted\n"${name}" has been deleted successfully.`,
		errorMessage: "Error\nFailed to delete MCP token",
	});

	const toggleTokenVisibility = (tokenId: string) => {
		setVisibleTokens((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(tokenId)) {
				newSet.delete(tokenId);
			} else {
				newSet.add(tokenId);
			}
			return newSet;
		});
	};

	const handleCopyMcpToken = async (mcpToken: MCPToken) => {
		await copyMcpTokenToClipboard(
			mcpToken.mcp_token,
			(message: string) => toast.success(message),
			(message: string) => toast.error(message),
		);
	};

	const handleCopyMcpConfig = async (token: MCPToken) => {
		await MCPConfigService.copyToClipboard(
			{ token: token.mcp_token },
			(message: string) => toast.success(message),
			(message: string) => toast.error(message),
		);
	};

	const handleAddToCursor = (token: MCPToken) => {
		MCPConfigService.openCursorLink(token.mcp_token);
		toast.success("Look for the Cursor window and click 'Install' to add MCP.");
	};

	const handleCopyForClient = async (token: MCPToken, clientType: string, clientName: string) => {
		const configJson = MCPConfigService.generateJsonString({
			token: token.mcp_token,
			clientType: clientType as
				| "cursor"
				| "augmentcode"
				| "cline"
				| "roocode"
				| "vscode"
				| "vscode-insiders"
				| "generic",
		});
		await navigator.clipboard.writeText(configJson);
		toast.success(`${clientName} configuration copied to clipboard!`);
	};

	const handleInstallVSCode = (token: MCPToken) => {
		const installUrl = MCPConfigService.generateVSCodeInstallUrl(token.mcp_token);
		window.open(installUrl, "_blank");
		toast.success("Look for the VS Code window and click 'Install' to add MCP.");
	};

	const handleInstallVSCodeInsiders = (token: MCPToken) => {
		const installUrl = MCPConfigService.generateVSCodeInsidersInstallUrl(token.mcp_token);
		window.open(installUrl, "_blank");
		toast.success("Look for the VS Code Insiders window and click 'Install' to add MCP.");
	};

	// 使用统一的时间处理工具库
	// formatDate 函数已从 utils 导入，无需本地定义

	// Define columns for the DataTable
	const columns: DataTableColumn[] = [
		{
			key: "name",
			label: "Name",
			render: (_, row: MCPToken) => (
				<div className="max-w-xs">
					<EditableName id={row.id} initialName={row.name} onUpdate={updateMCPToken} type="token" />
				</div>
			),
		},
		{
			key: "mcp_token",
			label: "Token",
			render: (_, row: MCPToken) => (
				<div className="space-y-2">
					<div className="flex items-center space-x-2">
						<code className="text-sm font-mono text-subtle bg-tertiary px-2 py-1 rounded border border-default font-mono tracking-wider break-all flex-1 min-w-0">
							{getMcpTokenDisplayText(row.mcp_token, visibleTokens.has(row.id))}
						</code>
						<div className="flex space-x-1 flex-shrink-0">
							<Button
								size="icon"
								variant="ghost"
								onClick={() => toggleTokenVisibility(row.id)}
								title={visibleTokens.has(row.id) ? "Hide token" : "Show token"}
								className="text-muted hover:text-light"
							>
								{visibleTokens.has(row.id) ? (
									<IconEyeOff className="h-4 w-4" />
								) : (
									<IconEye className="h-4 w-4" />
								)}
							</Button>
							<Button
								size="icon"
								variant="ghost"
								onClick={() => handleCopyMcpToken(row)}
								title="Copy token"
								className="text-muted hover:text-light"
							>
								<IconClipboard className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</div>
			),
		},
		{
			key: "created_at",
			label: "Created",
			render: (value) => (
				<div className="text-sm text-muted-foreground select-none">{formatDate(value)}</div>
			),
		},
		{
			key: "last_used_at",
			label: "Last Used",
			render: (value) => (
				<div className="text-sm text-muted-foreground select-none">
					{value ? formatDate(value) : "Never"}
				</div>
			),
		},
		{
			key: "actions",
			label: "",
			render: (_, row: MCPToken) => {
				const menuItems: DropdownMenuItem[] = [
					{
						key: "copy-json",
						label: "Copy JSON",
						icon: <IconClipboard className="h-4 w-4" />,
						onClick: () => handleCopyMcpConfig(row),
					},
					{
						key: "add-to-cursor",
						label: "Add to Cursor",
						icon: (
							<img
								src="https://cursor.com/_next/static/media/placeholder-logo.da8a9d2b.webp"
								alt="Cursor"
								width={16}
								height={16}
								className="w-4 h-4"
							/>
						),
						onClick: () => handleAddToCursor(row),
					},
					{
						key: "copy-for-augmentcode",
						label: "Copy for Augment Code",
						icon: (
							<img
								src="https://www.augmentcode.com/favicon.ico"
								alt="Augment Code"
								width={16}
								height={16}
								className="w-4 h-4"
							/>
						),
						onClick: () => handleCopyForClient(row, "augmentcode", "Augment Code"),
					},
					{
						key: "copy-for-cline",
						label: "Copy for Cline",
						icon: (
							<img
								src="https://cline.bot/assets/branding/favicons/favicon-32x32.png"
								alt="Cline"
								width={16}
								height={16}
								className="w-4 h-4"
							/>
						),
						onClick: () => handleCopyForClient(row, "cline", "Cline"),
					},
					{
						key: "copy-for-roocode",
						label: "Copy for Roo Code",
						icon: (
							<img
								src="https://roocode.com/favicon.ico"
								alt="Roo Code"
								width={16}
								height={16}
								className="w-4 h-4"
							/>
						),
						onClick: () => handleCopyForClient(row, "roocode", "Roo Code"),
					},
					{
						key: "install-vscode",
						label: "Install in VS Code",
						icon: (
							<img
								src="https://api.iconify.design/vscode-icons:file-type-vscode.svg"
								alt="VS Code"
								width={16}
								height={16}
								className="w-4 h-4"
							/>
						),
						onClick: () => handleInstallVSCode(row),
					},
					{
						key: "install-vscode-insiders",
						label: "Install in VS Code Insiders",
						icon: (
							<img
								src="https://api.iconify.design/vscode-icons:file-type-vscode-insiders.svg"
								alt="VS Code Insiders"
								width={16}
								height={16}
								className="w-4 h-4"
							/>
						),
						onClick: () => handleInstallVSCodeInsiders(row),
					},
					{
						key: "delete",
						label: "Delete",
						icon: <IconTrash className="h-4 w-4" />,
						onClick: () => handleDeleteClick(row.id, row.name),
						variant: "destructive" as const,
						disabled: isDeleting === row.id,
					},
				];

				return (
					<div className="text-right">
						<DropdownMenu
							trigger={
								<Button
									size="icon"
									variant="ghost"
									className="h-8 w-8 text-muted hover:text-light"
									disabled={isDeleting === row.id}
								>
									{isDeleting === row.id ? (
										<LoaderFive text="..." />
									) : (
										<IconDots className="h-4 w-4" />
									)}
								</Button>
							}
							items={menuItems}
							align="right"
						/>
					</div>
				);
			},
		},
	];

	// 加载状态：显示 LoaderFive
	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<LoaderFive text="Loading MCP tokens..." />
			</div>
		);
	}

	// 空状态：只在不加载且数据为空时显示
	if (tokens.length === 0) {
		return (
			<div className="p-6 text-center">
				<div className="mx-auto h-12 w-12 text-gray-500 dark:text-gray-400">
					<IconKey className="h-12 w-12" />
				</div>
				<h3 className="mt-2 text-sm font-medium text-gray-100 dark:text-gray-100">No MCP tokens</h3>
				<p className="mt-1 text-sm text-gray-400 dark:text-gray-400">
					Get started by creating a new MCP token.
				</p>
			</div>
		);
	}

	return (
		<>
			<DataTable columns={columns} data={tokens} />

			{/* Delete Confirmation Modal */}
			<DeleteModal />
		</>
	);
}
