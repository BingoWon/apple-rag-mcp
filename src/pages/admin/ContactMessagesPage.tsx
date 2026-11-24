/**
 * Admin Contact Messages Page
 * Display and manage contact messages with reply functionality
 */
import { IconEye, IconEyeCheck, IconLock, IconMessageCircle } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminPagedList } from "@/components/admin/AdminPagedList";
import { AdminUserLabel } from "@/components/admin/AdminUserLabel";
import { MessageReplyDialog } from "@/components/admin/MessageReplyDialog";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { formatDateCompact } from "@/lib/datetime";
import type { AdminContactMessage } from "@/types/admin-contact";

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
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const replyTrigger = useRef<HTMLButtonElement | null>(null);
	const refreshButton = useRef<HTMLButtonElement | null>(null);
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

	const handleReplySuccess = () => {
		fetchMessages(currentPage);
	};

	// Pure button design - button as status
	const getActionButton = (message: AdminContactMessage) => {
		// Anonymous message
		if (!message.can_reply) {
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
					onClick={(event) => {
						replyTrigger.current = event.currentTarget;
						setSelectedMessage(message);
					}}
					size="sm"
					className="bg-brand text-white font-semibold hover:bg-brand/90 whitespace-nowrap"
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
						onClick={(event) => {
							replyTrigger.current = event.currentTarget;
							setSelectedMessage(message);
						}}
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
					onClick={(event) => {
						replyTrigger.current = event.currentTarget;
						setSelectedMessage(message);
					}}
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
		<div className="flex h-full flex-col gap-6">
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
					ref={refreshButton}
					onClick={() => fetchMessages(currentPage)}
					disabled={isLoading}
					loading={isLoading}
					variant="primary"
				>
					{t("common.refresh")}
				</Button>
			</div>

			{/* Error State */}
			{error && (
				<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
					<p className="text-red-800 dark:text-red-400">{error}</p>
				</div>
			)}

			{/* Messages Table */}
			<AdminPagedList
				currentPage={currentPage}
				pageSize={limit}
				total={total}
				onPageChange={fetchMessages}
				isLoading={isLoading}
				header={
					<dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
						{(
							[
								["total", total],
								["pending", stats.pending],
								["replied", stats.replied],
								["read", stats.readByUser],
							] as const
						).map(([key, value]) => (
							<div key={key} className="flex items-baseline gap-1.5">
								<dt className="text-muted-foreground">{t(`admin.${key}`)}</dt>
								<dd className="font-semibold tabular-nums">{value}</dd>
							</div>
						))}
					</dl>
				}
			>
				<table className="w-full min-w-2xl table-fixed">
					<thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
						<tr>
							<th className="w-1/5 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
								{t("admin.col_user_name")}
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
										<div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
									</div>
								</td>
							</tr>
						) : messages.length === 0 ? (
							<tr>
								<td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
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
											<div className="font-medium text-gray-900 dark:text-white">
												<AdminUserLabel user={message.user} />
											</div>
											<p className="text-xs text-muted">
												{t(message.can_reply ? "admin.logged_in_user" : "admin.anonymous_feedback")}
											</p>
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
			</AdminPagedList>

			{/* Reply Dialog */}
			{selectedMessage && (
				<MessageReplyDialog
					message={selectedMessage}
					onClose={() => setSelectedMessage(null)}
					onReturnFocus={() => {
						(replyTrigger.current?.isConnected
							? replyTrigger.current
							: refreshButton.current
						)?.focus();
					}}
					onSuccess={handleReplySuccess}
				/>
			)}
		</div>
	);
}
