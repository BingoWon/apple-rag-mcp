import { IconCheck, IconPencil, IconX } from "@tabler/icons-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";

// 预设配置，消除重复参数
const EDITABLE_CONFIGS = {
	token: {
		entityType: "Token",
		successMessage: "Token name updated successfully",
		errorMessage: "Failed to update token name",
		emptyMessage: "Token name cannot be empty",
	},
	ip: {
		entityType: "Authorized IP",
		successMessage: "Authorized IP name updated successfully",
		errorMessage: "Failed to update IP name",
		emptyMessage: "IP name cannot be empty",
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
	const [isEditing, setIsEditing] = useState(false);
	const [name, setName] = useState(initialName);
	const [isLoading, setIsLoading] = useState(false);

	const config = EDITABLE_CONFIGS[type];

	const handleSave = async () => {
		if (name.trim() === "") {
			toast.error(config.emptyMessage);
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
			toast.success(config.successMessage);
			onRefresh?.();
		} catch (_error) {
			toast.error(config.errorMessage);
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
					className="text-sm font-medium text-light bg-tertiary border border-default rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
					disabled={isLoading}
				/>
				<Button
					variant="ghost"
					size="icon"
					onClick={handleSave}
					disabled={isLoading}
					className="h-8 w-8 text-success hover:text-success/80"
					title="Save"
				>
					<IconCheck className="h-4 w-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					onClick={handleCancel}
					disabled={isLoading}
					className="h-8 w-8 text-error hover:text-error/80"
					title="Cancel"
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
				className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
				title="Edit name"
			>
				<IconPencil className="h-4 w-4" />
			</Button>
		</div>
	);
}
