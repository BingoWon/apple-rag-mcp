import { IconTrash, IconWorld } from "@tabler/icons-react";
import { useCallback, useMemo } from "react";
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
	const { handleDeleteClick, isDeleting, DeleteModal } = useDeleteConfirm({
		onDelete: useCallback(onDelete, [onDelete]),
		onRefresh: useCallback(onRefresh, [onRefresh]),
		itemType: "Authorized IP",
		title: "Delete Authorized IP",
		successMessage: useCallback(
			(name: string) => `Authorized IP Deleted\n"${name}" has been deleted successfully.`,
			[],
		),
		errorMessage: "Error\nFailed to delete authorized IP",
	});

	// Define columns for the DataTable
	const columns: DataTableColumn[] = useMemo(
		() => [
			{
				key: "name",
				label: "Name",
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
				label: "IP Address",
				render: (value) => (
					<code className="text-sm font-mono text-subtle bg-tertiary px-2 py-1 rounded border border-default font-mono tracking-wider">
						{value}
					</code>
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
				render: (_, row: AuthorizedIP) => (
					<div className="text-right">
						<Button
							size="icon"
							variant="ghost"
							onClick={() => handleDeleteClick(row.id, row.name)}
							disabled={isDeleting === row.id}
							className="text-error hover:text-error/80"
							title="Delete authorized IP"
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
		[handleDeleteClick, isDeleting, onUpdate, onRefresh],
	);

	// Loading state
	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<LoaderFive text="Loading authorized IPs..." />
			</div>
		);
	}

	// Empty state
	if (ips.length === 0) {
		return (
			<div className="p-6 text-center">
				<div className="mx-auto h-12 w-12 text-gray-500 dark:text-gray-400">
					<IconWorld className="h-12 w-12" />
				</div>
				<h3 className="mt-2 text-sm font-medium text-gray-100 dark:text-gray-100">
					No authorized IPs
				</h3>
				<p className="mt-1 text-sm text-gray-400 dark:text-gray-400">
					Get started by adding your first authorized IP address.
				</p>
			</div>
		);
	}

	return (
		<>
			<DataTable columns={columns} data={ips} />

			{/* Delete Confirmation Modal */}
			<DeleteModal />
		</>
	);
}
