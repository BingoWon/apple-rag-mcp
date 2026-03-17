import { IconAlertTriangle } from "@tabler/icons-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ModalBody, ModalContent, useModal } from "./animated-modal";
import { Button } from "./Button";

interface DeleteConfirmModalProps {
	title: string;
	itemName: string;
	isDeleting?: boolean;
	onConfirm: () => void;
}

export function DeleteConfirmModal({
	title,
	itemName,
	isDeleting = false,
	onConfirm,
}: DeleteConfirmModalProps) {
	const { t } = useTranslation();
	const { setOpen } = useModal();

	// Auto-open the modal when component mounts
	useEffect(() => {
		setOpen(true);
	}, [setOpen]);

	const handleConfirm = () => {
		onConfirm();
	};

	const handleCancel = () => {
		if (!isDeleting) {
			setOpen(false);
		}
	};

	return (
		<ModalBody className="max-w-sm">
			<ModalContent className="space-y-4">
				{/* Warning Icon */}
				<div className="flex items-center justify-center">
					<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
						<IconAlertTriangle className="h-6 w-6 text-destructive" />
					</div>
				</div>

				{/* Header */}
				<div className="text-center">
					<h2 className="text-xl font-semibold text-foreground">{title}</h2>
				</div>

				{/* Content */}
				<div className="text-center space-y-2">
					<p className="text-sm text-muted-foreground">
						{t("delete_modal.confirm_text", { name: itemName })}
					</p>
					<p className="text-xs text-muted-foreground/80">{t("delete_modal.warning")}</p>
				</div>

				{/* Actions */}
				<div className="flex gap-3">
					<Button variant="outline" onClick={handleCancel} disabled={isDeleting} className="flex-1">
						{t("common.cancel")}
					</Button>
					<Button
						variant="destructive"
						onClick={handleConfirm}
						loading={isDeleting}
						disabled={isDeleting}
						className="flex-1"
					>
						{t("common.delete")}
					</Button>
				</div>
			</ModalContent>
		</ModalBody>
	);
}
