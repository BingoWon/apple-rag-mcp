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
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { LoaderFive } from "@/components/ui/loader";
import { MCP_SERVER_URL } from "@/constants/mcp";
import { COPY_CLIENTS, INSTALL_CLIENTS } from "@/constants/mcpClients";
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
	const { t } = useTranslation();
	const { updateMCPToken, deleteMCPToken } = useDashboardStore();
	const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());

	const { handleDeleteClick, isDeleting, DeleteModal } = useDeleteConfirm({
		onDelete: deleteMCPToken,
		onRefresh,
		itemType: t("tokens.token"),
		title: t("tokens.delete_title"),
		successMessage: (name) => t("tokens.deleted_success", { name }),
		errorMessage: t("tokens.delete_error_full"),
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

	/** Build dropdown menu items for a token, consuming the shared MCP_CLIENTS registry */
	const buildMenuItems = (row: MCPToken): DropdownMenuItem[] => {
		const installItems: DropdownMenuItem[] = INSTALL_CLIENTS.map((client) => ({
			key: client.key,
			label: client.label,
			icon: <img src={client.logo} alt={client.alt} width={16} height={16} className="w-4 h-4" />,
			onClick: async () => {
				try {
					const messageKey = await client.action(row.mcp_token, MCP_SERVER_URL);
					toast.success(t(messageKey, { client: client.label }));
				} catch {
					toast.error(t("common.copy_failed"));
				}
			},
		}));

		const copyItems: DropdownMenuItem[] = [
			{
				key: "copy-json",
				label: t("tokens.copy_json"),
				icon: <IconClipboard className="h-4 w-4" />,
				onClick: () => handleCopyMcpConfig(row),
			},
			...COPY_CLIENTS.map((client) => ({
				key: client.key,
				label: client.label,
				icon: <img src={client.logo} alt={client.alt} width={16} height={16} className="w-4 h-4" />,
				onClick: async () => {
					try {
						const messageKey = await client.action(row.mcp_token, MCP_SERVER_URL);
						toast.success(t(messageKey, { client: client.label }));
					} catch {
						toast.error(t("common.copy_failed"));
					}
				},
			})),
		];

		return [
			{ key: "label-install", label: t("guide.section_install"), type: "label" as const },
			...installItems,
			{ key: "sep-1", label: "", type: "separator" as const },
			{ key: "label-copy", label: t("guide.section_copy"), type: "label" as const },
			...copyItems,
			{ key: "sep-2", label: "", type: "separator" as const },
			{
				key: "delete",
				label: t("common.delete"),
				icon: <IconTrash className="h-4 w-4" />,
				onClick: () => handleDeleteClick(row.id, row.name),
				variant: "destructive" as const,
				disabled: isDeleting === row.id,
			},
		];
	};

	const columns: DataTableColumn[] = [
		{
			key: "name",
			label: t("common.name"),
			render: (_, row: MCPToken) => (
				<div className="max-w-xs">
					<EditableName id={row.id} initialName={row.name} onUpdate={updateMCPToken} type="token" />
				</div>
			),
		},
		{
			key: "mcp_token",
			label: t("tokens.token"),
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
								title={visibleTokens.has(row.id) ? t("tokens.hide_token") : t("tokens.show_token")}
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
								title={t("tokens.copy_token")}
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
			label: t("common.created"),
			render: (value) => (
				<div className="text-sm text-muted-foreground select-none">
					{formatDate(value as string)}
				</div>
			),
		},
		{
			key: "last_used_at",
			label: t("tokens.last_used"),
			render: (value) => (
				<div className="text-sm text-muted-foreground select-none">
					{value ? formatDate(value as string) : t("common.never")}
				</div>
			),
		},
		{
			key: "actions",
			label: "",
			render: (_, row: MCPToken) => (
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
						items={buildMenuItems(row)}
						align="right"
					/>
				</div>
			),
		},
	];

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<LoaderFive text={t("tokens.loading")} />
			</div>
		);
	}

	if (tokens.length === 0) {
		return (
			<div className="p-6 text-center">
				<div className="mx-auto h-12 w-12 text-gray-500 dark:text-gray-400">
					<IconKey className="h-12 w-12" />
				</div>
				<h3 className="mt-2 text-sm font-medium text-gray-100 dark:text-gray-100">
					{t("tokens.empty")}
				</h3>
				<p className="mt-1 text-sm text-gray-400 dark:text-gray-400">{t("tokens.empty_desc")}</p>
			</div>
		);
	}

	return (
		<>
			<DataTable columns={columns} data={tokens} />
			<DeleteModal />
		</>
	);
}
