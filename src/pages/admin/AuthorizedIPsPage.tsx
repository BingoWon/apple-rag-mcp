/**
 * Admin Authorized IPs Page
 * Display and manage authorized IP addresses across all users
 */
import { useCallback, useEffect, useState } from "react";
import { AdminTable } from "@/components/admin/AdminTable";
import { api } from "@/lib/api";

interface AdminAuthorizedIP {
	user_id: string;
	user_email: string;
	user_name: string;
	name: string;
	ip_address: string;
	created_at: string;
	updated_at: string;
	last_used?: string;
}

const columns = [
	{ key: "user_email", label: "User Email", width: "w-64" },
	{ key: "user_name", label: "User Name", width: "w-48" },
	{ key: "name", label: "IP Name", width: "w-48" },
	{ key: "ip_address", label: "IP Address", width: "w-40" },
	{ key: "last_used", label: "Last Used", width: "w-40" },
	{ key: "created_at", label: "Created", width: "w-40" },
	{ key: "updated_at", label: "Updated", width: "w-40" },
];

export default function AdminAuthorizedIPsPage() {
	const [ips, setIPs] = useState<AdminAuthorizedIP[]>([]);
	const [total, setTotal] = useState(0);
	const [limit, setLimit] = useState(50);
	const [offset, setOffset] = useState(0);
	const [hasMore, setHasMore] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchIPs = useCallback(
		async (page: number = 1) => {
			try {
				setIsLoading(true);
				setError(null);

				const response = await api.getAdminAuthorizedIPs(page, limit);

				if (response.success && response.data) {
					const data = response.data as {
						ips: AdminAuthorizedIP[];
						total: number;
						limit: number;
						offset: number;
						hasMore: boolean;
					};
					setIPs(data.ips || []);
					setTotal(data.total || 0);
					setLimit(data.limit || 50);
					setOffset(data.offset || 0);
					setHasMore(data.hasMore || false);
					setCurrentPage(page);
				} else {
					setError(response.error?.message || "Failed to fetch authorized IPs");
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to fetch authorized IPs");
			} finally {
				setIsLoading(false);
			}
		},
		[limit],
	);

	const handlePageChange = (page: number) => {
		fetchIPs(page);
	};

	useEffect(() => {
		fetchIPs(1);
	}, [fetchIPs]);

	// No need to format data - AdminTable will handle time formatting automatically

	return (
		<div className="space-y-6">
			<AdminTable
				title="Authorized IP Addresses"
				description={`All authorized IP addresses across users (${total} total)`}
				columns={columns}
				data={ips}
				total={total}
				limit={limit}
				offset={offset}
				hasMore={hasMore}
				currentPage={currentPage}
				isLoading={isLoading}
				error={error}
				onRefresh={() => fetchIPs(currentPage)}
				onPageChange={handlePageChange}
			/>
		</div>
	);
}
