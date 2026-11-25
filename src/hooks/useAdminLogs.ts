import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import type { AdminLogFilters, AdminLogKind, AdminLogsResponse } from "@/types/admin-logs";

export function useAdminLogs(kind: AdminLogKind) {
	const [searchParams, setSearchParams] = useSearchParams();
	const filters = useMemo<AdminLogFilters>(
		() =>
			Object.fromEntries(
				[...searchParams].filter(([key]) =>
					[
						"channel",
						"q",
						"outcome",
						"reason",
						"source",
						"provider",
						"cache",
						"start",
						"end",
						"from",
						"to",
					].includes(key),
				),
			),
		[searchParams],
	);
	const filtersKey = JSON.stringify(filters);
	const prevFiltersKey = useRef(filtersKey);
	const [query, setQuery] = useState({
		page: 1,
		limit: 50,
		revision: 0,
	});
	useEffect(() => {
		if (prevFiltersKey.current !== filtersKey) {
			prevFiltersKey.current = filtersKey;
			setQuery((q) => (q.page === 1 ? q : { ...q, page: 1 }));
		}
	}, [filtersKey]);
	const [data, setData] = useState<AdminLogsResponse | null>(null);
	const [loading, setLoading] = useState(true),
		[error, setError] = useState(false);
	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setError(false);
		api
			.getAdminLogs(kind, query.page, query.limit, filters, controller.signal)
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
	}, [kind, query, filters]);
	return {
		data,
		loading,
		error,
		query: { ...query, filters },
		apply: (values: AdminLogFilters) => {
			const params = new URLSearchParams();
			for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
			setQuery((q) => ({ ...q, page: 1 }));
			setSearchParams(params);
		},
		goToPage: (page: number) => setQuery((q) => ({ ...q, page })),
		changeLimit: (limit: number) => setQuery((q) => ({ ...q, limit, page: 1 })),
		refresh: () => setQuery((q) => ({ ...q, revision: q.revision + 1 })),
	};
}
