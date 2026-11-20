import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import {
	PaginationControls,
	type PaginationControlsProps,
} from "@/components/ui/PaginationControls";

export function AdminPagedList({
	header,
	children,
	...props
}: Pick<
	PaginationControlsProps,
	"currentPage" | "pageSize" | "total" | "onPageChange" | "onPageSizeChange" | "isLoading"
> & { header?: ReactNode; children: ReactNode }) {
	const pagination = { ...props, totalPages: Math.ceil(props.total / props.pageSize) };
	return (
		<div className="admin-list-panel min-h-0 min-w-0 flex-[1_0_16rem]">
			<Card className="flex max-h-full flex-col">
				{header}
				{pagination.totalPages > 1 && (
					<PaginationControls
						{...pagination}
						showPageSizeSelector={false}
						showInfo={false}
						className="shrink-0 border-t-0 border-b py-2"
					/>
				)}
				<div key={pagination.currentPage} className="min-h-0 overflow-auto">
					{children}
				</div>
				<PaginationControls
					{...pagination}
					showNavigation={pagination.totalPages > 1}
					className="shrink-0 py-2"
				/>
			</Card>
		</div>
	);
}
