/**
 * Admin Users Page
 * Display and manage users table
 */
import { useCallback, useEffect, useState } from "react";
import { AdminTable } from "@/components/admin/AdminTable";
import { api } from "@/lib/api";

interface AdminUser {
	id: string;
	email: string;
	name: string;
	provider?: string;
	avatar?: string;
	plan_type: string;
	subscription_status: string;
	last_login?: string;
	created_at: string;
	updated_at: string;
}

const columns = [
	{ key: "id", label: "ID", width: "w-16" },
	{ key: "email", label: "Email", width: "w-64" },
	{ key: "name", label: "Name", width: "w-48" },
	{ key: "provider", label: "Auth Provider", width: "w-32" },
	{ key: "plan_type", label: "Plan", width: "w-24" },
	{ key: "subscription_status", label: "Status", width: "w-28" },
	{ key: "last_login", label: "Last Login", width: "w-40" },
	{ key: "created_at", label: "Created", width: "w-40" },
	{ key: "updated_at", label: "Updated", width: "w-40" },
];

export default function AdminUsersPage() {
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [total, setTotal] = useState(0);
	const [limit, setLimit] = useState(50);
	const [offset, setOffset] = useState(0);
	const [hasMore, setHasMore] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchUsers = useCallback(
		async (page: number = 1) => {
			try {
				setIsLoading(true);
				setError(null);

				const response = await api.getAdminUsers(page, limit);

				if (response.success && response.data) {
					const data = response.data as {
						users: AdminUser[];
						total: number;
						limit: number;
						offset: number;
						hasMore: boolean;
					};
					setUsers(data.users || []);
					setTotal(data.total || 0);
					setLimit(data.limit || 50);
					setOffset(data.offset || 0);
					setHasMore(data.hasMore || false);
					setCurrentPage(page);
				} else {
					throw new Error("Failed to fetch users data");
				}
			} catch (err) {
				console.error("Error fetching admin users:", err);
				setError(err instanceof Error ? err.message : "Failed to load users");
				setUsers([]);
				setTotal(0);
			} finally {
				setIsLoading(false);
			}
		},
		[limit],
	);

	const handlePageChange = (page: number) => {
		fetchUsers(page);
	};

	useEffect(() => {
		fetchUsers(1);
	}, [fetchUsers]);

	return (
		<div className="space-y-6">
			<AdminTable
				title="Users Table"
				description="User registrations and account information with server-side pagination"
				columns={columns}
				data={users}
				total={total}
				limit={limit}
				offset={offset}
				hasMore={hasMore}
				currentPage={currentPage}
				isLoading={isLoading}
				error={error}
				onRefresh={() => fetchUsers(currentPage)}
				onPageChange={handlePageChange}
			/>
		</div>
	);
}
