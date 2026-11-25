import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";

interface DeleteItem {
	id: string;
	name: string;
}

interface UseDeleteConfirmOptions {
	onDelete: (id: string) => Promise<void>;
	onRefresh?: () => void;
	itemType: string;
	title: string;
	successMessage?: (name: string) => string;
	errorMessage?: string;
}

export function useDeleteConfirm({
	onDelete,
	onRefresh,
	itemType,
	title,
	successMessage,
	errorMessage,
}: UseDeleteConfirmOptions) {
	const [deleteItem, setDeleteItem] = useState<DeleteItem | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const handleDeleteClick = useCallback((id: string, name: string) => {
		setDeleteItem({ id, name });
	}, []);

	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (!open && !isDeleting) {
				setDeleteItem(null);
			}
		},
		[isDeleting],
	);

	const handleDeleteConfirm = useCallback(async () => {
		if (!deleteItem) return;

		const { id, name } = deleteItem;
		setIsDeleting(true);

		try {
			await onDelete(id);

			const message = successMessage
				? successMessage(name)
				: `${itemType} Deleted\n"${name}" has been deleted successfully.`;

			toast.success(message);
			onRefresh?.();
			setDeleteItem(null);
		} catch (error) {
			const message = errorMessage || `Failed to delete ${itemType.toLowerCase()}`;
			toast.error(error instanceof Error ? error.message : message);
		} finally {
			setIsDeleting(false);
		}
	}, [deleteItem, onDelete, onRefresh, itemType, successMessage, errorMessage]);

	const deleteModal = (
		<DeleteConfirmModal
			open={Boolean(deleteItem)}
			onOpenChange={handleOpenChange}
			title={title}
			itemName={deleteItem?.name ?? ""}
			isDeleting={isDeleting}
			onConfirm={handleDeleteConfirm}
		/>
	);

	return {
		handleDeleteClick,
		isDeleting: isDeleting && deleteItem ? deleteItem.id : null,
		deleteModal,
	};
}
