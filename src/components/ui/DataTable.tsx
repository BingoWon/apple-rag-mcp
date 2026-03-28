import { IconXboxX } from "@tabler/icons-react";
import type { Key, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/Badge";
import { LoaderFive } from "@/components/ui/loader";
import { formatDate } from "@/lib/datetime";

export interface DataTableColumn {
	key: string;
	label: string;
	// biome-ignore lint/suspicious/noExplicitAny: row type varies by consumer
	render?: (value: unknown, row: any) => ReactNode;
}

export interface DataTableProps {
	columns: DataTableColumn[];
	// biome-ignore lint/suspicious/noExplicitAny: data rows are typed by consumer context
	data: any[];
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
	const { t } = useTranslation();

	const formatValue = (
		value: unknown,
		column: DataTableColumn,
		// biome-ignore lint/suspicious/noExplicitAny: row type varies
		row: any,
	): ReactNode => {
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
				<h3 className="text-lg font-medium text-foreground mb-2">{t("table.error")}</h3>
				<p className="text-muted-foreground">{error}</p>
			</div>
		);
	}

	return (
		<div className={className}>
			{isLoading ? (
				<div className="flex items-center justify-center py-12">
					<LoaderFive text={t("table.loading")} />
				</div>
			) : data.length === 0 ? (
				<div className="text-center py-12">
					<p className="text-muted-foreground">{t("table.no_data")}</p>
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
									key={(row.id as Key) || index}
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
	statusBadge: (statusCode: number, successLabel?: string, errorLabel?: string) => {
		if (statusCode === 200) {
			return (
				<Badge variant="success" className="flex items-center gap-1 w-fit">
					{successLabel || "Success"}
				</Badge>
			);
		}
		return (
			<Badge variant="destructive" className="flex items-center gap-1 w-fit">
				{errorLabel || "Error"}
			</Badge>
		);
	},

	formatDate: (dateString: string) => {
		return formatDate(dateString);
	},

	truncateText: (text: string, maxLength = 50) => {
		if (!text) return "—";
		return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
	},
};
