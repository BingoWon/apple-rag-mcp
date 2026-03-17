import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface DropdownMenuItem {
	key: string;
	label: string;
	icon?: React.ReactNode;
	onClick: () => void;
	variant?: "default" | "destructive";
	disabled?: boolean;
}

interface DropdownMenuProps {
	trigger: React.ReactNode;
	items: DropdownMenuItem[];
	align?: "left" | "right";
	className?: string;
}

export function DropdownMenu({ trigger, items, align = "right", className }: DropdownMenuProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [mounted, setMounted] = useState(false);
	const [position, setPosition] = useState({ top: 0, left: 0, right: 0 });
	const dropdownRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLDivElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	// Set mounted state
	useEffect(() => {
		setMounted(true);
	}, []);

	// Calculate position when opening
	const updatePosition = () => {
		if (triggerRef.current) {
			const rect = triggerRef.current.getBoundingClientRect();
			setPosition({
				top: rect.bottom + window.scrollY,
				left: rect.left + window.scrollX,
				right: window.innerWidth - rect.right - window.scrollX,
			});
		}
	};

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			// Check if click is outside both trigger and menu
			const isOutsideTrigger = triggerRef.current && !triggerRef.current.contains(target);
			const isOutsideMenu = menuRef.current && !menuRef.current.contains(target);

			if (isOutsideTrigger && isOutsideMenu) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isOpen]);

	const handleItemClick = (item: DropdownMenuItem) => {
		if (!item.disabled) {
			item.onClick();
			setIsOpen(false);
		}
	};

	const handleTriggerClick = () => {
		if (!isOpen) {
			updatePosition();
		}
		setIsOpen(!isOpen);
	};

	return (
		<div className={cn("relative", className)} ref={dropdownRef}>
			{/* Trigger */}
			<div ref={triggerRef} onClick={handleTriggerClick} className="cursor-pointer">
				{trigger}
			</div>

			{/* Dropdown Menu - Rendered in Portal */}
			{mounted &&
				isOpen &&
				createPortal(
					<div
						ref={menuRef}
						className={cn(
							"fixed min-w-[160px] z-50",
							"bg-tertiary border border-default rounded-md shadow-lg",
							"py-1",
						)}
						style={{
							top: position.top + 4, // mt-1 equivalent
							[align === "right" ? "right" : "left"]:
								align === "right" ? position.right : position.left,
						}}
					>
						{items.map((item) => (
							<button
								key={item.key}
								onClick={() => handleItemClick(item)}
								disabled={item.disabled}
								className={cn(
									"w-full text-left px-3 py-2 text-sm transition-colors",
									"flex items-center gap-2",
									"disabled:opacity-50 disabled:cursor-not-allowed",
									item.variant === "destructive"
										? "text-error hover:bg-error/10 hover:text-error"
										: "text-light hover:bg-secondary",
									!item.disabled && "hover:bg-secondary",
								)}
							>
								{item.icon && <span className="flex-shrink-0 w-4 h-4">{item.icon}</span>}
								<span className="flex-1">{item.label}</span>
							</button>
						))}
					</div>,
					document.body,
				)}
		</div>
	);
}
