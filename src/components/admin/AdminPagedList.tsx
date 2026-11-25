import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import {
	PaginationControls,
	type PaginationControlsProps,
} from "@/components/ui/PaginationControls";
import { cn } from "@/lib/utils";

export function AdminPagedList({
	header,
	children,
	total,
	...props
}: Pick<
	PaginationControlsProps,
	"currentPage" | "pageSize" | "onPageChange" | "onPageSizeChange" | "isLoading"
> & { total?: number; header?: ReactNode; children: ReactNode }) {
	const pagination = {
		...props,
		total: total ?? 0,
		totalPages: Math.ceil((total ?? 0) / props.pageSize),
	};
	const multiplePages = pagination.totalPages > 1;
	const hasToolbar = !!header || multiplePages;
	return (
		<div className="admin-list-panel flex min-h-0 min-w-0 flex-[1_0_16rem] flex-col">
			{hasToolbar && (
				<PaginationControls
					{...pagination}
					showPageSizeSelector={false}
					showInfo={false}
					showNavigation={multiplePages}
					className="shrink-0 justify-start gap-2 rounded-t-lg border border-border bg-card py-2"
				>
					{header}
				</PaginationControls>
			)}
			<div className="min-h-0 flex-[1_0_12rem]">
				<Card className={cn("flex max-h-full flex-col", hasToolbar && "rounded-t-none border-t-0")}>
					<div key={pagination.currentPage} className="min-h-0 overflow-auto">
						{children}
					</div>
					{total !== undefined && (
						<PaginationControls
							{...pagination}
							showNavigation={multiplePages}
							className="shrink-0 py-2"
						/>
					)}
				</Card>
			</div>
		</div>
	);
}
