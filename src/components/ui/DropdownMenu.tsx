import * as Menu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
export interface DropdownMenuItem {
	key: string;
	label: string;
	icon?: ReactNode;
	onClick?: () => void;
	variant?: "default" | "destructive";
	disabled?: boolean;
	type?: "item" | "separator" | "label";
}
interface DropdownMenuProps {
	trigger: ReactNode;
	items: DropdownMenuItem[];
	align?: "left" | "right";
	className?: string;
}
export function DropdownMenu({ trigger, items, align = "right", className }: DropdownMenuProps) {
	return (
		<Menu.Root>
			<Menu.Trigger asChild>{trigger}</Menu.Trigger>
			<Menu.Portal>
				<Menu.Content
					align={align === "right" ? "end" : "start"}
					sideOffset={6}
					collisionPadding={8}
					className={cn(
						"z-50 min-w-40 rounded-lg border border-border bg-card p-1 text-foreground shadow-lg",
						className,
					)}
				>
					{items.map((item) =>
						item.type === "separator" ? (
							<Menu.Separator key={item.key} className="my-1 h-px bg-border" />
						) : item.type === "label" ? (
							<Menu.Label key={item.key} className="px-3 py-2 text-xs font-medium text-subtle">
								{item.label}
							</Menu.Label>
						) : (
							<Menu.Item
								key={item.key}
								disabled={item.disabled}
								onSelect={item.onClick}
								className={cn(
									"flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
									item.variant === "destructive" && "text-destructive",
								)}
							>
								{item.icon}
								<span>{item.label}</span>
							</Menu.Item>
						),
					)}
				</Menu.Content>
			</Menu.Portal>
		</Menu.Root>
	);
}
