/**
 * Admin Contact Messages Page
 * Display and manage contact messages with reply functionality
 */
import { IconEye, IconEyeCheck, IconMessageCircle } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminPagedList } from "@/components/admin/AdminPagedList";
import { AdminUserLabel } from "@/components/admin/AdminUserLabel";
import { MessageReplyDialog } from "@/components/admin/MessageReplyDialog";
import { Button } from "@/components/ui/Button";
import { formatAdminDateTime } from "@/lib/admin-utils";
import { api } from "@/lib/api";
import type { AdminContactMessage } from "@/types/admin-contact";

interface MessageStats {
	pending: number;
	replied: number;
	readByUser: number;
	anonymous: number;
}

export default function AdminContactMessagesPage() {
	const { t, i18n } = useTranslation();
	const [messages, setMessages] = useState<AdminContactMessage[]>([]);
	const [total, setTotal] = useState(0);
	const [stats, setStats] = useState<MessageStats>({
		pending: 0,
		replied: 0,
		readByUser: 0,
		anonymous: 0,
	});
	const [limit, setLimit] = useState(50);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const replyTrigger = useRef<HTMLButtonElement | null>(null);
	const refreshButton = useRef<HTMLButtonElement | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	const [selectedMessage, setSelectedMessage] = useState<AdminContactMessage | null>(null);

	const fetchMessages = useCallback(
		async (page: number = 1, pageLimit: number = limit) => {
			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;

			try {
				setIsLoading(true);
				setError(null);

				const response = await api.getAdminContactMessages(page, pageLimit, controller.signal);
				if (controller.signal.aborted) return;

				if (response.success && response.data) {
					const data = response.data as {
						messages: AdminContactMessage[];
						total: number;
						stats: Partial<MessageStats>;
						limit: number;
					};
					const resolvedLimit = data.limit || pageLimit;
					const resolvedTotal = data.total || 0;
					const lastPage = Math.max(1, Math.ceil(resolvedTotal / resolvedLimit));
					if (page > lastPage) {
						void fetchMessages(lastPage, resolvedLimit);
						return;
					}
					setMessages(data.messages || []);
					setTotal(resolvedTotal);
					setStats({
						pending: data.stats?.pending ?? 0,
						replied: data.stats?.replied ?? 0,
						readByUser: data.stats?.readByUser ?? 0,
						anonymous: data.stats?.anonymous ?? 0,
					});
					setLimit(resolvedLimit);
					setCurrentPage(page);
				} else {
					throw new Error(t("admin.load_failed"));
				}
			} catch (err) {
				if (controller.signal.aborted) return;
				console.error("Error fetching admin contact messages:", err);
				setError(err instanceof Error ? err.message : t("admin.load_failed"));
				setMessages([]);
				setTotal(0);
			} finally {
				if (!controller.signal.aborted) {
					setIsLoading(false);
				}
			}
		},
		[limit, t],
	);

	const handleReplySuccess = () => {
		void fetchMessages(currentPage, limit);
	};

	const handlePageSizeChange = (nextLimit: number) => {
		setCurrentPage(1);
		setLimit(nextLimit);
	};

	// Pure button design - button as status
	const getActionButton = (message: AdminContactMessage) => {
		// Anonymous message - allow viewing full content in read-only dialog
		if (!message.can_reply) {
			return (
				<Button
					onClick={(event) => {
						replyTrigger.current = event.currentTarget;
						setSelectedMessage(message);
					}}
					size="sm"
					variant="secondary"
					className="whitespace-nowrap"
				>
					<IconEye className="w-4 h-4 mr-1.5" />
					{t("admin.view")}
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
					<span className="font-mono text-xs text-subtle whitespace-nowrap">
						{formatAdminDateTime(message.replied_at!)}
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
				<span className="font-mono text-xs text-subtle whitespace-nowrap">
					{formatAdminDateTime(message.replied_at!)}
				</span>
			</div>
		);
	};

	useEffect(() => {
		void fetchMessages(1, limit);
		return () => {
			abortRef.current?.abort();
		};
	}, [fetchMessages, limit]);

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
					onClick={() => void fetchMessages(currentPage, limit)}
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
				onPageChange={(page) => void fetchMessages(page, limit)}
				onPageSizeChange={handlePageSizeChange}
				isLoading={isLoading}
				header={
					<dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
						{(
							[
								["total", total],
								["pending", stats.pending],
								["replied", stats.replied],
								["read", stats.readByUser],
								["anonymous_count", stats.anonymous],
							] as const
						).map(([key, value]) => (
							<div key={key} className="flex items-baseline gap-1.5">
								<dt className="text-subtle">{t(`admin.${key}`)}</dt>
								<dd className="font-semibold tabular-nums">
									{value.toLocaleString(i18n.resolvedLanguage)}
								</dd>
							</div>
						))}
					</dl>
				}
			>
				<table className="w-full min-w-2xl table-fixed">
					<thead className="sticky top-0 z-10 bg-surface border-b border-border">
						<tr>
							<th className="w-[22%] px-6 py-3 text-left text-xs font-medium text-subtle uppercase tracking-wider">
								{t("admin.col_user_name")}
							</th>
							<th className="w-[42%] px-6 py-3 text-left text-xs font-medium text-subtle uppercase tracking-wider">
								{t("admin.col_message")}
							</th>
							<th className="w-[20%] px-6 py-3 text-left text-xs font-medium text-subtle uppercase tracking-wider">
								{t("admin.date")} · UTC+8
							</th>
							<th className="w-[16%] px-6 py-3 text-left text-xs font-medium text-subtle uppercase tracking-wider">
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
									<td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-subtle">
										{formatAdminDateTime(message.created_at)}
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
