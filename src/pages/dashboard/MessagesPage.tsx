import { IconCheck, IconClock, IconMessageCircle, IconSearch } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { activateFabContact } from "@/components/ui/FabButton";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/date";

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
			toast.error("Failed to load messages");
		} finally {
			setIsLoading(false);
		}
	}, [filter, search, page]);

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
				toast.success("Message marked as read");
				fetchMessages();
			}
		} catch (error) {
			console.error("Failed to mark message as read:", error);
			toast.error("Failed to mark message as read");
		}
	};

	const totalPages = Math.ceil(total / limit);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-light">Messages</h1>
					<p className="mt-1 text-sm text-muted">
						View and manage your conversation history with our support team
					</p>
				</div>
				<Button
					variant="primary"
					size="sm"
					onClick={() => activateFabContact()}
					className="whitespace-nowrap"
				>
					<IconMessageCircle className="w-4 h-4 mr-1.5" />
					Contact Us
				</Button>
			</div>

			{/* Unread Count Banner */}
			{unreadCount > 0 && (
				<Card className="bg-blue-500/10 border-blue-500/30">
					<CardContent className="p-4">
						<div className="flex items-center gap-2">
							<IconMessageCircle className="w-5 h-5 text-blue-400" />
							<p className="text-blue-400 font-medium">
								You have {unreadCount} unread {unreadCount === 1 ? "message" : "messages"}
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
								<CardTitle>Your Messages</CardTitle>
								<CardDescription>
									{isLoading ? "Loading..." : `Showing ${messages.length} of ${total} messages`}
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
									All
								</Button>
								<Button
									variant={filter === "unread" ? "primary" : "secondary"}
									onClick={() => {
										setFilter("unread");
										setPage(1);
									}}
									size="sm"
								>
									Unread
								</Button>
								<Button
									variant={filter === "read" ? "primary" : "secondary"}
									onClick={() => {
										setFilter("read");
										setPage(1);
									}}
									size="sm"
								>
									Read
								</Button>
							</div>
						</div>

						{/* Search Bar */}
						<div className="flex gap-2">
							<Input
								placeholder="Search messages..."
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
								Search
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="p-0">
					{isLoading ? (
						<div className="p-8 text-center text-muted">Loading messages...</div>
					) : messages.length === 0 ? (
						<div className="p-8 text-center text-muted">
							<IconMessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
							<p>No messages found</p>
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
												{message.user_read_at ? "Read" : "Unread"}
											</span>
										</div>
										<span className="text-xs text-muted">{formatDate(message.created_at)}</span>
									</div>

									{/* Your Message */}
									<div className="mb-4">
										<h4 className="text-sm font-medium text-muted mb-2">Your Message</h4>
										<div className="bg-secondary rounded-lg p-4 border border-default">
											<p className="text-light text-sm whitespace-pre-wrap">{message.message}</p>
										</div>
									</div>

									{/* Admin Reply */}
									{message.admin_reply && (
										<div className="mb-4">
											<h4 className="text-sm font-medium text-muted mb-2">Our Response</h4>
											<div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/30">
												<p className="text-light text-sm whitespace-pre-wrap">
													{message.admin_reply}
												</p>
												{message.replied_at && (
													<p className="text-xs text-blue-400 mt-2">
														Replied on {formatDate(message.replied_at)}
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
												Mark as Read
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
								Previous
							</Button>
							<span className="text-sm text-muted">
								Page {page} of {totalPages}
							</span>
							<Button
								variant="secondary"
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								disabled={page === totalPages}
							>
								Next
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
