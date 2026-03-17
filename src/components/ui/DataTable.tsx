import { IconXboxX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { LoaderFive } from "@/components/ui/loader";
import { formatDate } from "@/lib/datetime";

export interface DataTableColumn {
	key: string;
	label: string;
	render?: (value: any, row: any) => ReactNode;
}

export interface DataTableProps {
	columns: DataTableColumn[];
	data: Array<Record<string, any>>;
	isLoading?: boolean;
	error?: string | null;
	className?: string;
}

export function DataTable({
	columns,
	data,
	isLoading = false,
	error = null,
	className = "",
}: DataTableProps) {
	const formatValue = (value: any, column: DataTableColumn, row: any): ReactNode => {
		if (column.render) {
			return column.render(value, row);
		}

		if (value === null || value === undefined) {
			return <span className="text-muted-foreground italic">—</span>;
		}

		return String(value);
	};

	// Error state
	if (error) {
		return (
			<div className={`text-center py-8 ${className}`}>
				<div className="mx-auto h-12 w-12 text-red-500 mb-4">
					<IconXboxX className="h-12 w-12" />
				</div>
				<h3 className="text-lg font-medium text-foreground mb-2">Error Loading Data</h3>
				<p className="text-muted-foreground">{error}</p>
			</div>
		);
	}

	return (
		<div className={className}>
			{isLoading ? (
				<div className="flex items-center justify-center py-12">
					<LoaderFive text="Loading data..." />
				</div>
			) : data.length === 0 ? (
				<div className="text-center py-12">
					<p className="text-muted-foreground">No data available</p>
				</div>
			) : (
				<div className="overflow-x-auto overflow-y-visible">
					<table className="w-full">
						<thead className="bg-secondary/30">
							<tr className="border-b border-border">
								{columns.map((column) => (
									<th
										key={column.key}
										className="text-left py-3 px-3 font-medium text-muted-foreground text-sm uppercase tracking-wider select-none"
									>
										{column.label}
									</th>
								))}
							</tr>
						</thead>
						<tbody className="bg-background divide-y divide-border">
							{data.map((row, index) => (
								<tr
									key={row.id || index}
									className={`transition-colors duration-200 ${
										index % 2 === 0 ? "bg-secondary/50" : "bg-background"
									} hover:bg-secondary`}
								>
									{columns.map((column) => (
										<td key={column.key} className="py-3 px-3">
											<div className="text-sm text-foreground">
												{formatValue(row[column.key], column, row)}
											</div>
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

// Utility functions for common column renderers
export const DataTableRenderers = {
	statusBadge: (statusCode: number) => {
		if (statusCode === 200) {
			return (
				<Badge variant="success" className="flex items-center gap-1 w-fit">
					Success
				</Badge>
			);
		} else {
			return (
				<Badge variant="destructive" className="flex items-center gap-1 w-fit">
					Error
				</Badge>
			);
		}
	},

	formatDate: (dateString: string) => {
		// 使用统一的短格式时间显示 (Aug 23, 2025 at 17:44:27)
		return formatDate(dateString);
	},

	truncateText: (text: string, maxLength: number = 50) => {
		if (!text) return "—";
		return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
	},
};
