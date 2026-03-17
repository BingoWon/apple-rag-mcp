import { useState } from "react";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/animated-modal";
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

	const handleDeleteClick = (id: string, name: string) => {
		setDeleteItem({ id, name });
	};

	const handleDeleteConfirm = async () => {
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
	};

	const _handleDeleteCancel = () => {
		if (!isDeleting) {
			setDeleteItem(null);
		}
	};

	const DeleteModal = () =>
		deleteItem ? (
			<Modal key={`delete-${deleteItem.id}`}>
				<DeleteConfirmModal
					title={title}
					itemName={deleteItem.name}
					isDeleting={isDeleting}
					onConfirm={handleDeleteConfirm}
				/>
			</Modal>
		) : null;

	return {
		handleDeleteClick,
		isDeleting: isDeleting && deleteItem ? deleteItem.id : null,
		DeleteModal,
	};
}
