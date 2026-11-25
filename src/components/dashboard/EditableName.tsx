import { IconCheck, IconPencil, IconX } from "@tabler/icons-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";

const EDITABLE_CONFIGS = {
	token: {
		successKey: "tokens.rename_success",
		errorKey: "tokens.rename_error",
		emptyKey: "tokens.name_empty",
	},
	ip: {
		successKey: "ips.rename_success",
		errorKey: "ips.rename_error",
		emptyKey: "ips.name_empty",
	},
} as const;

type EditableType = keyof typeof EDITABLE_CONFIGS;

interface EditableNameProps {
	id: string;
	initialName: string;
	onUpdate: (id: string, name: string) => Promise<void>;
	onRefresh?: () => void;
	type: EditableType;
}

export function EditableName({ id, initialName, onUpdate, onRefresh, type }: EditableNameProps) {
	const { t } = useTranslation();
	const [isEditing, setIsEditing] = useState(false);
	const [name, setName] = useState(initialName);
	const [isLoading, setIsLoading] = useState(false);

	const config = EDITABLE_CONFIGS[type];

	const handleSave = async () => {
		if (name.trim() === "") {
			toast.error(t(config.emptyKey));
			return;
		}

		if (name.trim() === initialName) {
			setIsEditing(false);
			return;
		}

		setIsLoading(true);
		try {
			await onUpdate(id, name.trim());
			setIsEditing(false);
			toast.success(t(config.successKey));
			onRefresh?.();
		} catch (_error) {
			toast.error(t(config.errorKey));
			setName(initialName); // Reset to original name
		} finally {
			setIsLoading(false);
		}
	};

	const handleCancel = () => {
		setName(initialName);
		setIsEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSave();
		} else if (e.key === "Escape") {
			handleCancel();
		}
	};

	if (isEditing) {
		return (
			<div className="flex items-center space-x-2">
				<input
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					onKeyDown={handleKeyDown}
					className="text-sm font-medium text-foreground bg-surface-subtle border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
					disabled={isLoading}
				/>
				<Button
					variant="ghost"
					size="icon"
					onClick={handleSave}
					disabled={isLoading}
					className="h-8 w-8 text-success hover:text-success/80"
					title={t("common.save")}
					aria-label={t("common.save")}
				>
					<IconCheck className="h-4 w-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					onClick={handleCancel}
					disabled={isLoading}
					className="h-8 w-8 text-destructive hover:text-destructive/80"
					title={t("common.cancel")}
					aria-label={t("common.cancel")}
				>
					<IconX className="h-4 w-4" />
				</Button>
			</div>
		);
	}

	return (
		<div className="flex items-center space-x-2 group">
			<div className="text-sm font-medium text-foreground">{initialName}</div>
			<Button
				variant="ghost"
				size="icon"
				onClick={() => setIsEditing(true)}
				className="h-8 w-8 text-subtle hover:text-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
				title={t("common.edit_name")}
				aria-label={t("common.edit_name")}
			>
				<IconPencil className="h-4 w-4" />
			</Button>
		</div>
	);
}
