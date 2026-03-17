import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";

export interface PaginationControlsProps {
	currentPage: number;
	totalPages: number;
	pageSize: number;
	total: number;
	pageSizeOptions: number[];
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: number) => void;
	isLoading?: boolean;
	className?: string;
	showPageSizeSelector?: boolean;
	showInfo?: boolean;
}

export function PaginationControls({
	currentPage,
	totalPages,
	pageSize,
	total,
	pageSizeOptions,
	onPageChange,
	onPageSizeChange,
	isLoading = false,
	className = "",
	showPageSizeSelector = true,
	showInfo = true,
}: PaginationControlsProps) {
	const { t } = useTranslation();
	// Always render pagination controls, even for single page or no data
	// This provides consistent UI and shows current pagination state

	const startIndex = total > 0 ? (currentPage - 1) * pageSize + 1 : 0;
	const endIndex = Math.min(currentPage * pageSize, total);

	// Generate smart page numbers (max 5 pages shown)
	const getPageNumbers = () => {
		const pages: number[] = [];

		if (totalPages === 0) {
			// Show page 1 even when no data
			pages.push(1);
		} else if (totalPages <= 5) {
			// Show all pages if 5 or fewer
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else if (currentPage <= 3) {
			// Show first 5 pages
			for (let i = 1; i <= 5; i++) {
				pages.push(i);
			}
		} else if (currentPage >= totalPages - 2) {
			// Show last 5 pages
			for (let i = totalPages - 4; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			// Show current page and 2 pages on each side
			for (let i = currentPage - 2; i <= currentPage + 2; i++) {
				pages.push(i);
			}
		}

		return pages;
	};

	return (
		<div
			className={`flex items-center justify-between px-6 py-4 border-t border-border ${className}`}
		>
			{/* Left side: Page size selector and info */}
			<div className="flex items-center gap-4">
				{showPageSizeSelector && (
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">{t("pagination.show")}</span>
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
						<span className="text-sm text-muted-foreground">{t("pagination.per_page")}</span>
					</div>
				)}

				{showInfo && (
					<div className="text-sm text-muted-foreground">
						{t("common.showing_range", {
							from: total > 0 ? startIndex : 0,
							to: total > 0 ? endIndex : 0,
							total,
						})}
					</div>
				)}
			</div>

			{/* Right side: Page navigation */}
			<div className="flex items-center space-x-2">
				<Button
					variant="outline"
					size="sm"
					onClick={() => onPageChange(currentPage - 1)}
					disabled={currentPage === 1 || isLoading}
					className="flex items-center gap-1"
				>
					<IconChevronLeft className="h-4 w-4" />
					{t("common.previous")}
				</Button>

				<div className="flex items-center space-x-1">
					{getPageNumbers().map((pageNum) => (
						<Button
							key={pageNum}
							variant={currentPage === pageNum ? "default" : "outline"}
							size="sm"
							onClick={() => onPageChange(pageNum)}
							disabled={isLoading}
							className="w-8 h-8 p-0"
						>
							{pageNum}
						</Button>
					))}
				</div>

				<Button
					variant="outline"
					size="sm"
					onClick={() => onPageChange(currentPage + 1)}
					disabled={currentPage === totalPages || isLoading}
					className="flex items-center gap-1"
				>
					{t("common.next")}
					<IconChevronRight className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
