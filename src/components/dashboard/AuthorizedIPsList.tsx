import { IconTrash, IconWorld } from "@tabler/icons-react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { LoaderFive } from "@/components/ui/loader";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import { formatDate } from "@/lib/utils";
import { EditableName } from "./EditableName";

interface AuthorizedIP {
	id: string;
	ip_address: string;
	name: string;
	last_used_at: string | null;
	created_at: string;
	updated_at: string;
}

interface AuthorizedIPsListProps {
	ips: AuthorizedIP[];
	onRefresh: () => void;
	onUpdate: (id: string, name: string) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
	isLoading?: boolean;
}

export function AuthorizedIPsList({
	ips,
	onRefresh,
	onUpdate,
	onDelete,
	isLoading = false,
}: AuthorizedIPsListProps) {
	const { t } = useTranslation();
	const { handleDeleteClick, isDeleting, deleteModal } = useDeleteConfirm({
		onDelete: useCallback(onDelete, [onDelete]),
		onRefresh: useCallback(onRefresh, [onRefresh]),
		itemType: t("ips.ip_label"),
		title: t("ips.delete_title"),
		successMessage: useCallback((name: string) => t("ips.deleted_success", { name }), [t]),
		errorMessage: t("ips.delete_error_full"),
	});

	// Define columns for the DataTable
	const columns: DataTableColumn<AuthorizedIP>[] = useMemo(
		() => [
			{
				key: "name",
				label: t("common.name"),
				render: (_, row: AuthorizedIP) => (
					<div className="max-w-xs">
						<EditableName
							id={row.id}
							initialName={row.name}
							onUpdate={onUpdate}
							onRefresh={onRefresh}
							type="ip"
						/>
					</div>
				),
			},
			{
				key: "ip_address",
				label: t("ips.ip_label"),
				render: (value) => (
					<code className="text-sm font-mono text-muted bg-surface-subtle px-2 py-1 rounded border border-border font-mono tracking-wider">
						{String(value)}
					</code>
				),
			},
			{
				key: "created_at",
				label: t("common.created"),
				render: (value) => (
					<div className="text-sm text-subtle select-none">{formatDate(value as string)}</div>
				),
			},
			{
				key: "last_used_at",
				label: t("tokens.last_used"),
				render: (value) => (
					<div className="text-sm text-subtle select-none">
						{value ? formatDate(value as string) : t("common.never")}
					</div>
				),
			},
			{
				key: "actions",
				label: "",
				render: (_, row: AuthorizedIP) => (
					<div className="text-right">
						<Button
							size="icon"
							variant="ghost"
							onClick={() => handleDeleteClick(row.id, row.name)}
							disabled={isDeleting === row.id}
							className="text-destructive hover:text-destructive/80"
							title={t("ips.delete_label")}
						>
							{isDeleting === row.id ? (
								<LoaderFive text="..." />
							) : (
								<IconTrash className="h-4 w-4" />
							)}
						</Button>
					</div>
				),
			},
		],
		[handleDeleteClick, isDeleting, onUpdate, onRefresh, t],
	);

	// Loading state
	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<LoaderFive text={t("ips.loading")} />
			</div>
		);
	}

	// Empty state
	if (ips.length === 0) {
		return (
			<div className="p-6 text-center">
				<div className="mx-auto h-12 w-12 text-subtle">
					<IconWorld className="h-12 w-12" />
				</div>
				<h3 className="mt-2 text-sm font-medium text-foreground">{t("ips.empty")}</h3>
				<p className="mt-1 text-sm text-subtle">{t("ips.empty_desc")}</p>
			</div>
		);
	}

	return (
		<>
			<DataTable columns={columns} data={ips} />
			{deleteModal}
		</>
	);
}
