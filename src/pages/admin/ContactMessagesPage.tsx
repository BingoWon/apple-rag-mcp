/**
 * Admin Contact Messages Page
 * Display and manage contact messages with reply functionality
 */
import { IconEye, IconEyeCheck, IconLock, IconMessageCircle } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageReplyDialog } from "@/components/admin/MessageReplyDialog";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { formatDateCompact } from "@/lib/datetime";

interface AdminContactMessage {
	id: string;
	user_id: string | null;
	email: string | null;
	message: string;
	ip_address: string | null;
	admin_reply: string | null;
	replied_at: string | null;
	user_read_at: string | null;
	created_at: string;
}

interface MessageStats {
	pending: number;
	replied: number;
	readByUser: number;
}

export default function AdminContactMessagesPage() {
	const { t } = useTranslation();
	const [messages, setMessages] = useState<AdminContactMessage[]>([]);
	const [total, setTotal] = useState(0);
	const [stats, setStats] = useState<MessageStats>({
		pending: 0,
		replied: 0,
		readByUser: 0,
	});
	const [limit, setLimit] = useState(50);
	const [offset, setOffset] = useState(0);
	const [hasMore, setHasMore] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedMessage, setSelectedMessage] = useState<AdminContactMessage | null>(null);

	const fetchMessages = useCallback(
		async (page: number = 1) => {
			try {
				setIsLoading(true);
				setError(null);

				const response = await api.getAdminContactMessages(page, limit);

				if (response.success && response.data) {
					const data = response.data as {
						messages: AdminContactMessage[];
						total: number;
						stats: MessageStats;
						limit: number;
						offset: number;
						hasMore: boolean;
					};
					setMessages(data.messages || []);
					setTotal(data.total || 0);
					setStats(
						data.stats || {
							pending: 0,
							replied: 0,
							closed: 0,
						},
					);
					setLimit(data.limit || 50);
					setOffset(data.offset || 0);
					setHasMore(data.hasMore || false);
					setCurrentPage(page);
				} else {
					throw new Error("Failed to fetch contact messages data");
				}
			} catch (err) {
				console.error("Error fetching admin contact messages:", err);
				setError(err instanceof Error ? err.message : "Failed to load contact messages");
				setMessages([]);
				setTotal(0);
			} finally {
				setIsLoading(false);
			}
		},
		[limit],
	);

	const handlePageChange = (page: number) => {
		fetchMessages(page);
	};

	const handleReplySuccess = () => {
		fetchMessages(currentPage);
	};

	// Pure button design - button as status
	const getActionButton = (message: AdminContactMessage) => {
		// Anonymous message
		if (!message.user_id) {
			return (
				<Button
					disabled
					size="sm"
					className="bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-800"
				>
					<IconLock className="w-4 h-4 mr-1.5" />
					{t("admin.read_only")}
				</Button>
			);
		}

		// Not replied yet
		if (!message.admin_reply) {
			return (
				<Button
					onClick={() => setSelectedMessage(message)}
					size="sm"
					className="bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
				>
					<IconMessageCircle className="w-4 h-4 mr-1.5" />
					{t("admin.reply")}
				</Button>
			);
		}

		// Replied - user has read
		if (message.user_read_at) {
			return (
				<div className="flex flex-col gap-1 items-start">
					<Button
						onClick={() => setSelectedMessage(message)}
						size="sm"
						className="bg-green-600 text-white hover:bg-green-700 whitespace-nowrap"
					>
						<IconEyeCheck className="w-4 h-4 mr-1.5" />
						{t("admin.read")}
					</Button>
					<span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
						{formatDateCompact(message.replied_at!)}
					</span>
				</div>
			);
		}

		// Replied - user hasn't read yet
		return (
			<div className="flex flex-col gap-1 items-start">
				<Button
					onClick={() => setSelectedMessage(message)}
					size="sm"
					className="bg-orange-600 text-white hover:bg-orange-700 whitespace-nowrap"
				>
					<IconEye className="w-4 h-4 mr-1.5" />
					{t("admin.unread")}
				</Button>
				<span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
					{formatDateCompact(message.replied_at!)}
				</span>
			</div>
		);
	};

	useEffect(() => {
		fetchMessages(1);
	}, [fetchMessages]);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white">
						{t("admin.contact_messages")}
					</h1>
					<p className="text-gray-600 dark:text-gray-400 mt-1">
						{t("admin.contact_messages_subtitle")}
					</p>
				</div>
				<Button
					onClick={() => fetchMessages(currentPage)}
					disabled={isLoading}
					loading={isLoading}
					variant="primary"
				>
					{t("common.refresh")}
				</Button>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
					<p className="text-sm text-gray-600 dark:text-gray-400">{t("admin.total")}</p>
					<p className="text-2xl font-bold text-gray-900 dark:text-white">{total}</p>
				</div>
				<div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
					<p className="text-sm text-gray-600 dark:text-gray-400">{t("admin.pending")}</p>
					<p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
				</div>
				<div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
					<p className="text-sm text-gray-600 dark:text-gray-400">{t("admin.replied")}</p>
					<p className="text-2xl font-bold text-green-600">{stats.replied}</p>
				</div>
				<div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
					<p className="text-sm text-gray-600 dark:text-gray-400">{t("admin.read")}</p>
					<p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{stats.readByUser}</p>
				</div>
			</div>

			{/* Error State */}
			{error && (
				<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
					<p className="text-red-800 dark:text-red-400">{error}</p>
				</div>
			)}

			{/* Messages Table */}
			<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full table-fixed">
						<thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
							<tr>
								<th className="w-1/5 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									{t("admin.col_email")}
								</th>
								<th className="w-2/5 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									{t("admin.col_message")}
								</th>
								<th className="w-1/6 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									{t("admin.date")}
								</th>
								<th className="w-1/6 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									{t("admin.action")}
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200 dark:divide-gray-700">
							{isLoading ? (
								<tr>
									<td colSpan={4} className="px-6 py-12 text-center">
										<div className="flex items-center justify-center">
											<div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
										</div>
									</td>
								</tr>
							) : messages.length === 0 ? (
								<tr>
									<td
										colSpan={4}
										className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
									>
										{t("admin.no_messages")}
									</td>
								</tr>
							) : (
								messages.map((message) => (
									<tr
										key={message.id}
										className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
									>
										<td className="px-6 py-4">
											<div className="text-sm">
												{message.user_id ? (
													<>
														<p className="font-medium text-gray-900 dark:text-white break-words">
															{message.email || t("admin.no_email")}
														</p>
														<p className="text-blue-600 dark:text-blue-400 text-xs whitespace-nowrap">
															{t("admin.logged_in_user")}
														</p>
													</>
												) : (
													<>
														<p className="font-medium text-gray-500 dark:text-gray-400 break-words">
															{message.email || t("admin.anonymous")}
														</p>
														<p className="text-amber-600 dark:text-amber-400 text-xs whitespace-nowrap">
															{t("admin.anonymous_feedback")}
														</p>
													</>
												)}
											</div>
										</td>
										<td className="px-6 py-4 max-w-md">
											<div className="space-y-1">
												<p className="text-sm text-gray-900 dark:text-white line-clamp-2 break-words">
													{message.message}
												</p>
												{message.admin_reply && (
													<p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 break-words">
														{t("admin.reply_preview", { reply: message.admin_reply })}
													</p>
												)}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
											{formatDateCompact(message.created_at)}
										</td>
										<td className="px-6 py-4">{getActionButton(message)}</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				{/* Pagination */}
				{!isLoading && messages.length > 0 && (
					<div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
						<p className="text-sm text-gray-600 dark:text-gray-400">
							{t("common.showing_range", {
								from: offset + 1,
								to: Math.min(offset + limit, total),
								total,
							})}
						</p>
						<div className="flex gap-2">
							<Button
								onClick={() => handlePageChange(currentPage - 1)}
								disabled={currentPage === 1}
								variant="secondary"
							>
								{t("common.previous")}
							</Button>
							<Button
								onClick={() => handlePageChange(currentPage + 1)}
								disabled={!hasMore}
								variant="secondary"
							>
								{t("common.next")}
							</Button>
						</div>
					</div>
				)}
			</div>

			{/* Reply Dialog */}
			{selectedMessage && (
				<MessageReplyDialog
					message={selectedMessage}
					onClose={() => setSelectedMessage(null)}
					onSuccess={handleReplySuccess}
				/>
			)}
		</div>
	);
}
