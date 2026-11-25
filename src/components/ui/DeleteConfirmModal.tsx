import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./Dialog";

export interface DeleteConfirmModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	itemName: string;
	isDeleting?: boolean;
	onConfirm: () => void;
}

export function DeleteConfirmModal({
	open,
	onOpenChange,
	title,
	itemName,
	isDeleting = false,
	onConfirm,
}: DeleteConfirmModalProps) {
	const { t } = useTranslation();

	const handleOpenChange = (next: boolean) => {
		if (!next && isDeleting) return;
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="max-w-sm"
				onEscapeKeyDown={(event) => {
					if (isDeleting) event.preventDefault();
				}}
				onInteractOutside={(event) => {
					if (isDeleting) event.preventDefault();
				}}
			>
				<div className="space-y-4">
					<div className="flex items-center justify-center">
						<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
							<IconAlertTriangle aria-hidden="true" className="h-6 w-6 text-destructive" />
						</div>
					</div>

					<div className="text-center space-y-2">
						<DialogTitle className="text-xl font-semibold text-foreground">{title}</DialogTitle>
						<DialogDescription className="text-sm text-subtle">
							{t("delete_modal.confirm_text", { name: itemName })}
						</DialogDescription>
						<p className="text-xs text-subtle/80">{t("delete_modal.warning")}</p>
					</div>

					<div className="flex gap-3 pt-1">
						<Button
							variant="outline"
							onClick={() => handleOpenChange(false)}
							disabled={isDeleting}
							className="flex-1"
						>
							{t("common.cancel")}
						</Button>
						<Button
							variant="destructive"
							onClick={onConfirm}
							loading={isDeleting}
							disabled={isDeleting}
							className="flex-1"
						>
							{t("common.delete")}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
