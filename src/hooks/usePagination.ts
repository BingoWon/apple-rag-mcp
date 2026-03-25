import { useCallback, useEffect, useState } from "react";

export interface PaginationState {
	currentPage: number;
	pageSize: number;
	total: number;
	totalPages: number;
	hasNext: boolean;
	hasPrev: boolean;
	isLoading: boolean;
	error: string | null;
}

export interface PaginatedApiResponse<T> {
	success: boolean;
	data: {
		items: T[];
		pagination: {
			page: number;
			limit: number;
			total: number;
			total_pages: number;
			has_next: boolean;
			has_prev: boolean;
		};
	};
	error?: {
		message: string;
	};
}

export interface UsePaginationOptions {
	initialPageSize?: number;
	pageSizeOptions?: number[];
}

export interface UsePaginationReturn<T> extends PaginationState {
	data: T[];
	pageSizeOptions: number[];
	goToPage: (page: number) => void;
	changePageSize: (size: number) => void;
	refresh: () => void;
	nextPage: () => void;
	prevPage: () => void;
}

export function usePagination<T>(
	fetchFn: (page: number, limit: number) => Promise<PaginatedApiResponse<T>>,
	options: UsePaginationOptions = {},
): UsePaginationReturn<T> {
	const { initialPageSize = 20, pageSizeOptions = [20, 50, 100] } = options;

	const [data, setData] = useState<T[]>([]);
	const [currentPage, setCurrentPage] = useState(1);
	const [pageSize, setPageSize] = useState(initialPageSize);
	const [total, setTotal] = useState(0);
	const [totalPages, setTotalPages] = useState(0);
	const [hasNext, setHasNext] = useState(false);
	const [hasPrev, setHasPrev] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = useCallback(
		async (page: number, limit: number) => {
			try {
				setIsLoading(true);
				setError(null);

				const response = await fetchFn(page, limit);

				if (response.success && response.data) {
					setData(response.data.items || []);
					setTotal(response.data.pagination.total);
					setTotalPages(response.data.pagination.total_pages);
					setHasNext(response.data.pagination.has_next);
					setHasPrev(response.data.pagination.has_prev);
					setCurrentPage(response.data.pagination.page);
					setPageSize(response.data.pagination.limit);
				} else {
					throw new Error(response.error?.message || "Failed to fetch data");
				}
			} catch (err) {
				console.error("Pagination fetch error:", err);
				setError(err instanceof Error ? err.message : "Failed to load data");
				setData([]);
				setTotal(0);
				setTotalPages(0);
				setHasNext(false);
				setHasPrev(false);
			} finally {
				setIsLoading(false);
			}
		},
		[fetchFn],
	);

	const goToPage = useCallback(
		(page: number) => {
			if (page >= 1 && page <= totalPages && page !== currentPage) {
				fetchData(page, pageSize);
			}
		},
		[fetchData, pageSize, totalPages, currentPage],
	);

	const changePageSize = useCallback(
		(size: number) => {
			if (size !== pageSize) {
				setPageSize(size);
				fetchData(1, size);
			}
		},
		[fetchData, pageSize],
	);

	const refresh = useCallback(() => {
		fetchData(currentPage, pageSize);
	}, [fetchData, currentPage, pageSize]);

	const nextPage = useCallback(() => {
		if (hasNext) {
			goToPage(currentPage + 1);
		}
	}, [hasNext, currentPage, goToPage]);

	const prevPage = useCallback(() => {
		if (hasPrev) {
			goToPage(currentPage - 1);
		}
	}, [hasPrev, currentPage, goToPage]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: only run on mount or when fetchFn identity changes
	useEffect(() => {
		fetchData(1, initialPageSize);
	}, [fetchData]);

	return {
		data,
		currentPage,
		pageSize,
		total,
		totalPages,
		hasNext,
		hasPrev,
		isLoading,
		error,
		pageSizeOptions,
		goToPage,
		changePageSize,
		refresh,
		nextPage,
		prevPage,
	};
}
