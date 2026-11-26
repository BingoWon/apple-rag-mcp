import * as Menu from "@radix-ui/react-dropdown-menu";
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
	value: string;
	label: string;
	meta?: string;
}

interface UpdatesSelectProps {
	value: string;
	options: readonly SelectOption[];
	onChange: (value: string) => void;
	ariaLabel: string;
	icon?: ReactNode;
	mono?: boolean;
	align?: "start" | "end";
	className?: string;
}

/**
 * Accessible h-8 (32px) dropdown selector built on Radix DropdownMenu.
 * Guarantees pixel-identical height and centered baseline alignment alongside
 * segmented tabs across macOS, Linux, and Windows browsers.
 */
export function UpdatesSelect({
	value,
	options,
	onChange,
	ariaLabel,
	icon,
	mono = false,
	align = "end",
	className,
}: UpdatesSelectProps) {
	const selected = options.find((opt) => opt.value === value) ?? options[0];

	return (
		<Menu.Root>
			<Menu.Trigger asChild>
				<button
					type="button"
					aria-label={ariaLabel}
					className={cn(
						"inline-flex h-8 shrink-0 items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 text-xs font-medium leading-none text-foreground transition-colors duration-150 hover:border-border-strong hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background data-[state=open]:border-border-strong data-[state=open]:bg-surface",
						mono && "font-mono tabular-nums",
						className,
					)}
				>
					<span className="inline-flex items-center gap-1.5 truncate">
						{icon && (
							<span className="inline-flex shrink-0 text-subtle" aria-hidden="true">
								{icon}
							</span>
						)}
						<span className="truncate">{selected?.label ?? value}</span>
					</span>
					<IconChevronDown className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
				</button>
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Content
					align={align}
					sideOffset={6}
					collisionPadding={8}
					className="z-50 max-h-72 min-w-[11rem] overflow-y-auto rounded-xl border border-border bg-card p-1 text-foreground shadow-complex"
				>
					{options.map((opt) => {
						const isSelected = opt.value === value;
						return (
							<Menu.Item
								key={opt.value}
								onSelect={() => onChange(opt.value)}
								className={cn(
									"flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-xs leading-none outline-none transition-colors duration-100 data-[highlighted]:bg-surface",
									isSelected ? "font-medium text-foreground" : "text-muted",
								)}
							>
								<span className="inline-flex min-w-0 items-center gap-2">
									<span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
										{isSelected && (
											<IconCheck
												className="h-3.5 w-3.5 text-brand-strong dark:text-brand"
												aria-hidden="true"
											/>
										)}
									</span>
									<span className={cn("truncate", mono && "font-mono tabular-nums")}>
										{opt.label}
									</span>
								</span>
								{opt.meta && (
									<span className="shrink-0 font-mono text-[11px] tabular-nums text-subtle">
										{opt.meta}
									</span>
								)}
							</Menu.Item>
						);
					})}
				</Menu.Content>
			</Menu.Portal>
		</Menu.Root>
	);
}
