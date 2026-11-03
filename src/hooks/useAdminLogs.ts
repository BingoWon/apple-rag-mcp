import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AdminLogFilters, AdminLogKind, AdminLogsResponse } from "@/types/admin-logs";

export function useAdminLogs(kind: AdminLogKind) {
	const [query, setQuery] = useState({
		page: 1,
		limit: 50,
		filters: {} as AdminLogFilters,
		revision: 0,
	});
	const [data, setData] = useState<AdminLogsResponse | null>(null);
	const [loading, setLoading] = useState(true),
		[error, setError] = useState(false);
	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setError(false);
		api
			.getAdminLogs(kind, query.page, query.limit, query.filters, controller.signal)
			.then((response) => {
				if (!response.success || !response.data) throw Error("Logs unavailable");
				if (!controller.signal.aborted) {
					const lastPage = Math.max(1, Math.ceil(response.data.total / query.limit));
					if (query.page > lastPage) setQuery((q) => ({ ...q, page: lastPage }));
					else setData(response.data);
				}
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setData(null);
					setError(true);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		return () => controller.abort();
	}, [kind, query]);
	return {
		data,
		loading,
		error,
		query,
		apply: (filters: AdminLogFilters) => setQuery((q) => ({ ...q, filters, page: 1 })),
		goToPage: (page: number) => setQuery((q) => ({ ...q, page })),
		changeLimit: (limit: number) => setQuery((q) => ({ ...q, limit, page: 1 })),
		refresh: () => setQuery((q) => ({ ...q, revision: q.revision + 1 })),
	};
}
