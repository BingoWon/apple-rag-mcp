import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { LoaderFive } from "@/components/ui/loader";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { UsageLogItem } from "@/types";

export function RecentQueries() {
	const [queries, setQueries] = useState<UsageLogItem[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchRecentQueries = async () => {
			try {
				setIsLoading(true);
				setError(null);

				// Fetch real usage logs from API
				const response = await api.getUsageLogs(20); // Get last 20 usage logs for dashboard

				if (response.success && response.data) {
					const usageData = response.data as {
						items: UsageLogItem[];
						pagination: {
							total: number;
							page: number;
							limit: number;
							totalPages: number;
						};
					};
					setQueries(usageData.items || []);
				} else {
					throw new Error("Failed to fetch usage logs");
				}
			} catch (error) {
				console.error("Failed to fetch recent queries:", error);
				setError(error instanceof Error ? error.message : "Failed to load usage logs");
				setQueries([]); // Clear queries on error
			} finally {
				setIsLoading(false);
			}
		};

		fetchRecentQueries();
	}, []);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Usage History</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<LoaderFive text="Loading usage history..." />
						</div>
					) : error ? (
						<div className="text-center py-6">
							<p className="text-sm text-red-600 mb-2">Failed to load usage logs</p>
							<p className="text-xs text-gray-400">{error}</p>
							<Button
								onClick={() => window.location.reload()}
								variant="link"
								size="sm"
								className="mt-2 text-xs"
							>
								Try again
							</Button>
						</div>
					) : (
						<>
							{queries.map((query) => (
								<div
									key={query.id}
									className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
								>
									<div className="flex-1 min-w-0">
										<p
											className="text-sm font-medium text-gray-900 truncate"
											title={query.query || "No query text"}
										>
											{query.query || "No query text"}
										</p>
										<div className="flex items-center space-x-2 mt-1">
											<Badge variant={query.status === "success" ? "default" : "destructive"}>
												{query.status}
											</Badge>
											{query.status === "success" && query.response_time_ms > 0 && (
												<span className="text-xs text-gray-500">{query.response_time_ms}ms</span>
											)}
											<span className="text-xs text-gray-500">{query.result_count} results</span>
											<span className="text-xs text-gray-500">{formatDate(query.created_at)}</span>
										</div>
									</div>
								</div>
							))}
							{queries.length === 0 && (
								<div className="text-center py-6">
									<p className="text-sm text-gray-500">No usage logs</p>
									<p className="text-xs text-gray-400 mt-1">
										Start making MCP API calls to see your usage history
									</p>
								</div>
							)}
						</>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
