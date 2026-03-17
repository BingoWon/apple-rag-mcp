/**
 * Modern Tab Component
 * Elegant, accessible tab interface for content switching
 */
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
	id: string;
	label: string;
	content: ReactNode;
	badge?: number;
}

interface TabsProps {
	items: TabItem[];
	defaultTab?: string;
	className?: string;
	onTabChange?: (tabId: string) => void;
}

export function Tabs({ items, defaultTab, className, onTabChange }: TabsProps) {
	const [activeTab, setActiveTab] = useState(defaultTab || items[0]?.id);

	const handleTabChange = (tabId: string) => {
		setActiveTab(tabId);
		onTabChange?.(tabId);
	};

	const activeItem = items.find((item) => item.id === activeTab);

	return (
		<div className={cn("w-full", className)}>
			{/* Tab Headers */}
			<div className="border-b border-border">
				<nav className="flex space-x-8" aria-label="Tabs">
					{items.map((item) => (
						<button
							type="button"
							key={item.id}
							onClick={() => handleTabChange(item.id)}
							className={cn(
								"whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
								activeTab === item.id
									? "border-brand text-brand"
									: "border-transparent text-muted-foreground hover:text-foreground hover:border-border-light",
							)}
							aria-current={activeTab === item.id ? "page" : undefined}
						>
							<span className="flex items-center gap-2">
								{item.label}
								{item.badge !== undefined && (
									<span
										className={cn(
											"inline-flex items-center justify-center px-2 py-1 text-xs font-bold rounded-full transition-colors",
											activeTab === item.id
												? "bg-brand text-white"
												: "bg-subtle text-inverse border border-border-light",
										)}
									>
										{item.badge}
									</span>
								)}
							</span>
						</button>
					))}
				</nav>
			</div>

			{/* Tab Content */}
			<div className="mt-6">{activeItem?.content}</div>
		</div>
	);
}
