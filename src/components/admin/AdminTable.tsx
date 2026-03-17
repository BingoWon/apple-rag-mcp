/**
 * Admin Table Component
 * Reusable table component for displaying database records with pagination
 */
import { IconChevronLeft, IconChevronRight, IconRefresh } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { formatAdminDateTime, formatAdminResponseTime, getCountryFlag } from "@/lib/admin-utils";

interface AdminTableColumn {
	key: string;
	label: string;
	width?: string;
	render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface AdminTableProps<T = Record<string, unknown>> {
	title: string;
	description?: string;
	columns: AdminTableColumn[];
	data: T[];
	total: number;
	limit: number;
	offset: number;
	hasMore: boolean;
	currentPage: number;
	isLoading?: boolean;
	error?: string | null;
	note?: string;
	onRefresh?: () => void;
	onPageChange?: (page: number) => void;
}

export function AdminTable<T = Record<string, unknown>>({
	title,
	description,
	columns,
	data,
	total,
	limit,
	offset,
	hasMore,
	currentPage,
	isLoading = false,
	error = null,
	onRefresh,
	onPageChange,
}: AdminTableProps<T>) {
	const { t } = useTranslation();
	// Calculate pagination info
	const totalPages = Math.ceil(total / limit);
	const startIndex = offset + 1;
	const endIndex = Math.min(offset + limit, total);
	// Convert AdminTable columns to DataTable columns
	const dataTableColumns: DataTableColumn[] = columns.map((col) => ({
		key: col.key,
		label: col.label,
		width: col.width,
		render: (value: unknown, row: Record<string, unknown>) => {
			// Use custom render if provided
			if (col.render) {
				return col.render(value, row);
			}

			if (value === null || value === undefined) {
				return <span className="text-muted-foreground italic">null</span>;
			}

			if (col.key === "country_code") {
				return (
					<span className="text-lg" title={value as string}>
						{getCountryFlag(value as string)}
					</span>
				);
			}

			if (col.key === "response_time_ms") {
				return <span className="font-mono">{formatAdminResponseTime(value as number)}</span>;
			}

			if (
				col.key === "last_login" ||
				col.key === "current_period_start" ||
				col.key === "current_period_end" ||
				col.key === "last_used" ||
				col.key === "trial_end" ||
				col.key.endsWith("_at") ||
				col.key.endsWith("_time")
			) {
				return <span className="font-mono text-sm">{formatAdminDateTime(value as string)}</span>;
			}

			// Special formatting for ID fields - truncate with ellipsis and tooltip
			if (col.key.includes("id") || col.key.includes("_id") || col.key === "mcp_token") {
				const stringValue = String(value);
				if (stringValue.length > 12) {
					return (
						<span title={stringValue} className="truncate block max-w-20 font-mono text-xs">
							{stringValue.substring(0, 12)}...
						</span>
					);
				}
				return <span className="font-mono text-xs">{stringValue}</span>;
			}

			if (typeof value === "boolean") {
				// Special handling for cancel_at_period_end: false=good(green), true=bad(red)
				const isInvertedLogic = col.key === "cancel_at_period_end";
				const isGoodState = isInvertedLogic ? !value : value;

				return (
					<span
						className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
							isGoodState
								? "bg-green-900 text-green-200 dark:bg-green-900 dark:text-green-200"
								: "bg-red-900 text-red-200 dark:bg-red-900 dark:text-red-200"
						}`}
					>
						{value ? "true" : "false"}
					</span>
				);
			}

			return String(value);
		},
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center justify-between">
					<div>
						<span>{title}</span>
						{description && (
							<p className="text-sm text-muted-foreground mt-1 font-normal">{description}</p>
						)}
					</div>
					{onRefresh && (
						<Button
							variant="outline"
							size="sm"
							onClick={onRefresh}
							className="flex items-center gap-2"
						>
							<IconRefresh className="h-4 w-4" />
							{t("common.refresh")}
						</Button>
					)}
				</CardTitle>
			</CardHeader>
			<CardContent className="p-0">
				<DataTable
					columns={dataTableColumns}
					data={data as Array<Record<string, any>>}
					isLoading={isLoading}
					error={error}
				/>

				{/* Server-side Pagination Controls */}
				{total > limit && (
					<div className="flex items-center justify-between px-6 py-4 border-t">
						<div className="text-sm text-muted-foreground">
							{t("common.showing_range", { from: startIndex, to: endIndex, total })}
						</div>
						<div className="flex items-center space-x-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => onPageChange?.(currentPage - 1)}
								disabled={currentPage === 1 || isLoading}
								className="flex items-center gap-1"
							>
								<IconChevronLeft className="h-4 w-4" />
								{t("common.previous")}
							</Button>

							<div className="flex items-center space-x-1">
								{/* Smart page numbers */}
								{Array.from({ length: Math.min(5, totalPages) }, (_item, i) => {
									let pageNum: number;
									if (totalPages <= 5) {
										pageNum = i + 1;
									} else if (currentPage <= 3) {
										pageNum = i + 1;
									} else if (currentPage >= totalPages - 2) {
										pageNum = totalPages - 4 + i;
									} else {
										pageNum = currentPage - 2 + i;
									}

									return (
										<Button
											key={pageNum}
											variant={currentPage === pageNum ? "default" : "outline"}
											size="sm"
											onClick={() => onPageChange?.(pageNum)}
											disabled={isLoading}
											className="w-8 h-8 p-0"
										>
											{pageNum}
										</Button>
									);
								})}
							</div>

							<Button
								variant="outline"
								size="sm"
								onClick={() => onPageChange?.(currentPage + 1)}
								disabled={currentPage === totalPages || isLoading}
								className="flex items-center gap-1"
							>
								{t("common.next")}
								<IconChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
