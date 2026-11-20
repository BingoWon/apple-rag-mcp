/**
 * Admin Table Component
 * Reusable table component for displaying database records with pagination
 */
import { IconRefresh } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { CardHeader, CardTitle } from "@/components/ui/Card";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { formatAdminDateTime, formatAdminResponseTime, getCountryFlag } from "@/lib/admin-utils";
import { AdminPagedList } from "./AdminPagedList";

interface AdminTableProps<T extends object> {
	title: string;
	description?: string;
	columns: DataTableColumn<T>[];
	data: T[];
	total: number;
	limit: number;
	currentPage: number;
	isLoading?: boolean;
	error?: string | null;
	onRefresh?: () => void;
	onPageChange: (page: number) => void;
}

export function AdminTable<T extends object>({
	title,
	description,
	columns,
	data,
	total,
	limit,
	currentPage,
	isLoading = false,
	error = null,
	onRefresh,
	onPageChange,
}: AdminTableProps<T>) {
	const { t } = useTranslation();
	// Convert AdminTable columns to DataTable columns
	const dataTableColumns: DataTableColumn<T>[] = columns.map((col) => ({
		key: col.key,
		label: col.label,
		width: col.width,
		render: (value: unknown, row: T) => {
			// Use custom render if provided
			if (col.render) {
				return col.render(value, row);
			}

			if (value === null || value === undefined) {
				return <span className="text-muted-foreground italic">—</span>;
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
			if (col.key === "id" || col.key.endsWith("_id") || col.key === "mcp_token") {
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
		<AdminPagedList
			currentPage={currentPage}
			pageSize={limit}
			total={total}
			onPageChange={onPageChange}
			isLoading={isLoading}
			header={
				<CardHeader className="shrink-0">
					<CardTitle className="flex flex-wrap items-center justify-between gap-3">
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
								disabled={isLoading}
								className="flex items-center gap-2"
							>
								<IconRefresh className="h-4 w-4" />
								{t("common.refresh")}
							</Button>
						)}
					</CardTitle>
				</CardHeader>
			}
		>
			<DataTable
				externalScroll
				columns={dataTableColumns}
				data={data}
				isLoading={isLoading}
				error={error}
			/>
		</AdminPagedList>
	);
}
