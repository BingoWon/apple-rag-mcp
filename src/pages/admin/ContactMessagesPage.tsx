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
					className="bg-surface-subtle text-subtle cursor-not-allowed hover:bg-surface-subtle"
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
						className="bg-success text-white font-semibold hover:bg-success/90 whitespace-nowrap"
					>
						<IconEyeCheck className="w-4 h-4 mr-1.5" />
						{t("admin.read")}
					</Button>
					<span className="text-xs text-subtle whitespace-nowrap">
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
					className="bg-warning text-slate-950 font-semibold hover:bg-warning/90 whitespace-nowrap"
				>
					<IconEye className="w-4 h-4 mr-1.5" />
					{t("admin.unread")}
				</Button>
				<span className="text-xs text-subtle whitespace-nowrap">
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
					<h1 className="text-2xl font-bold text-foreground">{t("admin.contact_messages")}</h1>
					<p className="text-subtle mt-1">{t("admin.contact_messages_subtitle")}</p>
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
				<div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
					<p className="text-destructive">{error}</p>
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
								<dt className="text-subtle">{t(`admin.${key}`)}</dt>
								<dd className="font-semibold tabular-nums">{value}</dd>
							</div>
						))}
					</dl>
				}
			>
				<table className="w-full min-w-2xl table-fixed">
					<thead className="sticky top-0 z-10 bg-surface border-b border-border">
						<tr>
							<th className="w-1/5 px-6 py-3 text-left text-xs font-medium text-subtle uppercase tracking-wider">
								{t("admin.col_user_name")}
							</th>
							<th className="w-2/5 px-6 py-3 text-left text-xs font-medium text-subtle uppercase tracking-wider">
								{t("admin.col_message")}
							</th>
							<th className="w-1/6 px-6 py-3 text-left text-xs font-medium text-subtle uppercase tracking-wider">
								{t("admin.date")}
							</th>
							<th className="w-1/6 px-6 py-3 text-left text-xs font-medium text-subtle uppercase tracking-wider">
								{t("admin.action")}
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
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
								<td colSpan={4} className="px-6 py-12 text-center text-subtle">
									{t("admin.no_messages")}
								</td>
							</tr>
						) : (
							messages.map((message) => (
								<tr key={message.id} className="hover:bg-surface/60 transition-colors">
									<td className="px-6 py-4">
										<div className="text-sm">
											<div className="font-medium text-foreground">
												<AdminUserLabel user={message.user} />
											</div>
											<p className="text-xs text-muted">
												{t(message.can_reply ? "admin.logged_in_user" : "admin.anonymous_feedback")}
											</p>
										</div>
									</td>
									<td className="px-6 py-4 max-w-md">
										<div className="space-y-1">
											<p className="text-sm text-foreground line-clamp-2 break-words">
												{message.message}
											</p>
											{message.admin_reply && (
												<p className="text-xs text-subtle line-clamp-1 break-words">
													{t("admin.reply_preview", { reply: message.admin_reply })}
												</p>
											)}
										</div>
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-subtle">
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
