import { IconCheck, IconClock, IconMessageCircle, IconSearch } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { activateFabContact } from "@/components/ui/FabButton";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { formatDateCompact } from "@/lib/datetime";
import { cn } from "@/lib/utils";

interface Message {
	id: string;
	message: string;
	admin_reply: string | null;
	replied_at: string | null;
	created_at: string;
	user_read_at: string | null;
}

type FilterType = "all" | "unread" | "read";

export default function MessagesPage() {
	const { t } = useTranslation();
	const [messages, setMessages] = useState<Message[]>([]);
	const [total, setTotal] = useState(0);
	const [unreadCount, setUnreadCount] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [filter, setFilter] = useState<FilterType>("all");
	const [search, setSearch] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const [page, setPage] = useState(1);
	const limit = 20;

	const fetchMessages = useCallback(async () => {
		setIsLoading(true);
		try {
			const offset = (page - 1) * limit;
			const response = await api.getMessageHistory({
				limit,
				offset,
				filter,
				search: search || undefined,
			});

			if (response.success && response.data) {
				const data = response.data as {
					messages: Message[];
					total: number;
					unreadCount: number;
				};
				setMessages(data.messages || []);
				setTotal(data.total || 0);
				setUnreadCount(data.unreadCount || 0);
			}
		} catch (error) {
			console.error("Failed to fetch messages:", error);
			toast.error(t("messages.load_error"));
		} finally {
			setIsLoading(false);
		}
	}, [filter, search, page, t]);

	useEffect(() => {
		fetchMessages();
	}, [fetchMessages]);

	const handleSearch = () => {
		setSearch(searchInput);
		setPage(1);
	};

	const handleMarkAsRead = async (messageId: string) => {
		try {
			const response = await api.markMessageAsRead(messageId);
			if (response.success) {
				toast.success(t("messages.marked_success"));
				fetchMessages();
			}
		} catch (error) {
			console.error("Failed to mark message as read:", error);
			toast.error(t("messages.mark_error"));
		}
	};

	const totalPages = Math.ceil(total / limit);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-light">{t("messages.title")}</h1>
					<p className="mt-1 text-sm text-muted">{t("messages.subtitle")}</p>
				</div>
				<Button
					variant="primary"
					size="sm"
					onClick={() => activateFabContact()}
					className="whitespace-nowrap"
				>
					<IconMessageCircle className="w-4 h-4 mr-1.5" />
					{t("common.contact_us")}
				</Button>
			</div>

			{/* Unread Count Banner */}
			{unreadCount > 0 && (
				<Card className="bg-blue-500/10 border-blue-500/30">
					<CardContent className="p-4">
						<div className="flex items-center gap-2">
							<IconMessageCircle className="w-5 h-5 text-blue-400" />
							<p className="text-blue-400 font-medium">
								{unreadCount === 1
									? t("messages.unread_banner", { count: unreadCount })
									: t("messages.unread_banner_plural", { count: unreadCount })}
							</p>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Messages List with Filter and Search */}
			<Card>
				<CardHeader>
					<div className="flex flex-col gap-4">
						{/* Title and Filter Buttons */}
						<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
							<div>
								<CardTitle>{t("messages.your_messages")}</CardTitle>
								<CardDescription>
									{isLoading
										? t("messages.loading")
										: t("common.showing_of", { count: messages.length, total })}
								</CardDescription>
							</div>
							<div className="flex gap-2">
								<Button
									variant={filter === "all" ? "primary" : "secondary"}
									onClick={() => {
										setFilter("all");
										setPage(1);
									}}
									size="sm"
								>
									{t("messages.filter_all")}
								</Button>
								<Button
									variant={filter === "unread" ? "primary" : "secondary"}
									onClick={() => {
										setFilter("unread");
										setPage(1);
									}}
									size="sm"
								>
									{t("messages.filter_unread")}
								</Button>
								<Button
									variant={filter === "read" ? "primary" : "secondary"}
									onClick={() => {
										setFilter("read");
										setPage(1);
									}}
									size="sm"
								>
									{t("messages.filter_read")}
								</Button>
							</div>
						</div>

						{/* Search Bar */}
						<div className="flex gap-2">
							<Input
								placeholder={t("messages.search_placeholder")}
								value={searchInput}
								onChange={(e) => setSearchInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										handleSearch();
									}
								}}
								className="flex-1"
							/>
							<Button onClick={handleSearch} variant="primary">
								<IconSearch className="w-4 h-4 mr-2" />
								{t("common.search")}
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="p-0">
					{isLoading ? (
						<div className="p-8 text-center text-muted">{t("messages.loading")}</div>
					) : messages.length === 0 ? (
						<div className="p-8 text-center text-muted">
							<IconMessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
							<p>{t("messages.empty")}</p>
						</div>
					) : (
						<div className="divide-y divide-default">
							{messages.map((message) => (
								<div
									key={message.id}
									className={cn("p-6 transition-colors", !message.user_read_at && "bg-blue-500/5")}
								>
									{/* Message Header */}
									<div className="flex items-start justify-between mb-4">
										<div className="flex items-center gap-2">
											{message.user_read_at ? (
												<IconCheck className="w-5 h-5 text-neutral-500" />
											) : (
												<IconClock className="w-5 h-5 text-blue-400" />
											)}
											<span
												className={cn(
													"text-sm font-medium",
													message.user_read_at ? "text-neutral-500" : "text-blue-400",
												)}
											>
												{message.user_read_at ? t("messages.read") : t("messages.unread")}
											</span>
										</div>
										<span className="text-xs text-muted">
											{formatDateCompact(message.created_at)}
										</span>
									</div>

									{/* Your Message */}
									<div className="mb-4">
										<h4 className="text-sm font-medium text-muted mb-2">
											{t("messages.your_message")}
										</h4>
										<div className="bg-secondary rounded-lg p-4 border border-default">
											<p className="text-light text-sm whitespace-pre-wrap">{message.message}</p>
										</div>
									</div>

									{/* Admin Reply */}
									{message.admin_reply && (
										<div className="mb-4">
											<h4 className="text-sm font-medium text-muted mb-2">
												{t("messages.our_response")}
											</h4>
											<div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/30">
												<p className="text-light text-sm whitespace-pre-wrap">
													{message.admin_reply}
												</p>
												{message.replied_at && (
													<p className="text-xs text-blue-400 mt-2">
														{t("messages.replied_on", {
															date: formatDateCompact(message.replied_at),
														})}
													</p>
												)}
											</div>
										</div>
									)}

									{/* Mark as Read Button */}
									{!message.user_read_at && (
										<div className="flex justify-end">
											<Button
												variant="secondary"
												size="sm"
												onClick={() => handleMarkAsRead(message.id)}
											>
												<IconCheck className="w-4 h-4 mr-2" />
												{t("messages.mark_read")}
											</Button>
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Pagination */}
			{totalPages > 1 && (
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<Button
								variant="secondary"
								onClick={() => setPage((p) => Math.max(1, p - 1))}
								disabled={page === 1}
							>
								{t("common.previous")}
							</Button>
							<span className="text-sm text-muted">
								{t("common.page_of", { page, total: totalPages })}
							</span>
							<Button
								variant="secondary"
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								disabled={page === totalPages}
							>
								{t("common.next")}
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
