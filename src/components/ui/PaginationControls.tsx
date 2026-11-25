import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface PaginationControlsProps {
	children?: ReactNode;
	currentPage: number;
	totalPages: number;
	pageSize: number;
	total: number;
	pageSizeOptions?: number[];
	onPageChange: (page: number) => void;
	onPageSizeChange?: (size: number) => void;
	isLoading?: boolean;
	className?: string;
	showPageSizeSelector?: boolean;
	showInfo?: boolean;
	showNavigation?: boolean;
}

export function PaginationControls({
	children,
	currentPage,
	totalPages,
	pageSize,
	total,
	pageSizeOptions = [20, 50, 100],
	onPageChange,
	onPageSizeChange,
	isLoading = false,
	className = "",
	showPageSizeSelector = true,
	showInfo = true,
	showNavigation = true,
}: PaginationControlsProps) {
	const { t } = useTranslation();
	const startIndex = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
	const endIndex = Math.min(currentPage * pageSize, total);

	const directionLabel = children ? "sr-only @5xl:not-sr-only" : "sr-only @sm:not-sr-only";
	const otherPage = children ? "hidden @3xl:inline-flex" : "hidden @min-[16rem]:inline-flex";
	const firstPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
	const pages = Array.from(
		{ length: Math.max(1, Math.min(5, totalPages)) },
		(_, index) => firstPage + index,
	);

	return (
		<div
			className={cn(
				"@container flex flex-wrap items-center justify-between gap-3 px-4 py-4 border-t border-border",
				className,
			)}
		>
			{children}
			{(showInfo || (showPageSizeSelector && onPageSizeChange)) && (
				<div className="flex flex-wrap items-center gap-3">
					{showPageSizeSelector && onPageSizeChange && (
						<div className="flex items-center gap-2">
							<span className="text-sm text-subtle">{t("pagination.show")}</span>
							<div className="flex items-center gap-1">
								{pageSizeOptions.map((size) => (
									<Button
										key={size}
										variant={pageSize === size ? "default" : "ghost"}
										size="sm"
										onClick={() => onPageSizeChange(size)}
										disabled={isLoading}
										className="h-8 px-2 text-xs"
									>
										{size}
									</Button>
								))}
							</div>
							<span className="text-sm text-subtle">{t("pagination.per_page")}</span>
						</div>
					)}

					{showInfo && (
						<div className="text-sm text-subtle">
							{t("common.showing_range", {
								from: total > 0 ? startIndex : 0,
								to: total > 0 ? endIndex : 0,
								total,
							})}
						</div>
					)}
				</div>
			)}

			{/* Right side: Page navigation */}
			{showNavigation && (
				<nav
					aria-label={t("pagination.label")}
					className="ml-auto flex items-center gap-1 sm:gap-2"
				>
					<Button
						variant="outline"
						size="sm"
						onClick={() => onPageChange(currentPage - 1)}
						disabled={currentPage <= 1 || isLoading}
						className="px-2 @sm:px-3"
					>
						<IconChevronLeft className="h-4 w-4" />
						<span className={directionLabel}>{t("common.previous")}</span>
					</Button>

					<div className="flex items-center space-x-1">
						{pages.map((pageNum) => (
							<Button
								key={pageNum}
								variant={currentPage === pageNum ? "default" : "outline"}
								aria-current={currentPage === pageNum ? "page" : undefined}
								size="sm"
								onClick={() => onPageChange(pageNum)}
								disabled={isLoading}
								className={cn("w-8 h-8 p-0", currentPage !== pageNum && otherPage)}
							>
								{pageNum}
							</Button>
						))}
					</div>

					<Button
						variant="outline"
						size="sm"
						onClick={() => onPageChange(currentPage + 1)}
						disabled={totalPages === 0 || currentPage >= totalPages || isLoading}
						className="px-2 @sm:px-3"
					>
						<span className={directionLabel}>{t("common.next")}</span>
						<IconChevronRight className="h-4 w-4" />
					</Button>
				</nav>
			)}
		</div>
	);
}
