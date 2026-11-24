import { IconCheck, IconMessageCircle, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CardSpotlight } from "@/components/ui/card-spotlight";
import { formatDateCompact } from "@/lib/datetime";
import { useAuthStore } from "@/stores/auth";
import { useDashboardStore } from "@/stores/dashboard";

export function UnreadReplyNotification() {
	const { user } = useAuthStore();
	const unreadMessages = useDashboardStore((state) => state.unreadReplies);
	const fetchUnreadReplies = useDashboardStore((state) => state.fetchUnreadReplies);
	const markReplyRead = useDashboardStore((state) => state.markReplyRead);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isVisible, setIsVisible] = useState(false);
	const [isMarking, setIsMarking] = useState(false);
	const { t } = useTranslation();

	useEffect(() => {
		if (!user) {
			setIsVisible(false);
			return;
		}
		let active = true;
		fetchUnreadReplies().then((messages) => {
			if (active && messages.length > 0) {
				setCurrentIndex(0);
				setIsVisible(true);
			}
		});
		return () => {
			active = false;
		};
	}, [user, fetchUnreadReplies]);

	const handleMarkAsRead = async () => {
		if (unreadMessages.length === 0) return;

		const currentMessage = unreadMessages[currentIndex];
		if (!currentMessage) return;
		setIsMarking(true);

		try {
			const marked = await markReplyRead(currentMessage.id);

			if (marked) {
				if (unreadMessages.length > 1) {
					setCurrentIndex(0);
				} else {
					setIsVisible(false);
				}
			}
		} catch (error) {
			console.error("Failed to mark message as read:", error);
		} finally {
			setIsMarking(false);
		}
	};

	const handleClose = () => {
		// Just close the modal, don't mark as read
		// User will see it again on next page load
		setIsVisible(false);
	};

	if (!isVisible || unreadMessages.length === 0) {
		return null;
	}

	const currentMessage = unreadMessages[currentIndex];
	const remainingCount = unreadMessages.length;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm animate-in fade-in duration-300">
			<CardSpotlight className="max-w-2xl w-full mx-4 max-h-[85vh] border border-default flex flex-col">
				{/* Scrollable Content Area */}
				<div className="relative z-20 p-8 pb-6 overflow-y-auto flex-1">
					{/* Header */}
					<div className="flex items-start justify-between mb-6">
						<div>
							<p className="text-2xl font-bold text-light flex items-center gap-2">
								{t("notification.got_reply")}
							</p>
							{remainingCount > 1 && (
								<p className="text-muted text-sm mt-1">
									{t(
										remainingCount === 1
											? "notification.unread_count"
											: "notification.unread_count_plural",
										{ count: remainingCount },
									)}
								</p>
							)}
						</div>
						<button
							type="button"
							onClick={handleClose}
							className="text-muted hover:text-light transition-all p-1 rounded-lg hover:bg-secondary/80 backdrop-blur-sm"
							aria-label={t("notification.close_for_now")}
						>
							<IconX className="w-6 h-6" />
						</button>
					</div>

					{/* Messages */}
					<div className="space-y-6">
						{/* Your Message */}
						<div>
							<div className="flex items-center justify-between mb-2">
								<p className="text-sm font-semibold text-muted">{t("notification.your_message")}</p>
								<p className="text-xs text-faint">{formatDateCompact(currentMessage.created_at)}</p>
							</div>
							<div className="p-4 rounded-lg bg-secondary backdrop-blur-sm border border-default">
								<p className="text-light whitespace-pre-wrap leading-relaxed">
									{currentMessage.message}
								</p>
							</div>
						</div>

						{/* Our Response */}
						<div>
							<div className="flex items-center justify-between mb-2">
								<p className="text-sm font-semibold text-brand">{t("notification.our_response")}</p>
								<p className="text-xs text-faint">{formatDateCompact(currentMessage.replied_at)}</p>
							</div>
							<div className="p-4 rounded-lg bg-blue-500/10 backdrop-blur-sm border border-blue-500/30">
								<p className="text-light whitespace-pre-wrap leading-relaxed">
									{currentMessage.admin_reply}
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Fixed Footer - Actions */}
				<div className="relative z-20 flex items-center justify-between gap-3 px-8 py-4 border-t border-default">
					<button
						type="button"
						onClick={handleClose}
						className="px-4 py-2 text-sm text-muted hover:text-light transition-all flex items-center gap-2 rounded-lg hover:bg-secondary/80 backdrop-blur-sm"
					>
						<IconX className="w-4 h-4" />
						<span>{t("notification.close_for_now")}</span>
					</button>
					<button
						type="button"
						onClick={handleMarkAsRead}
						disabled={isMarking}
						className="px-6 py-2 bg-brand text-white rounded-lg font-medium hover:bg-brand-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
					>
						{isMarking ? (
							<>
								<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
								<span>{t("notification.marking")}</span>
							</>
						) : (
							<>
								<IconCheck className="w-4 h-4" />
								<span>{t("notification.mark_read")}</span>
							</>
						)}
					</button>
				</div>

				{/* Fixed Footer - View All Messages Link */}
				<Link
					to="/messages"
					onClick={() => setIsVisible(false)}
					className="relative z-20 px-8 py-4 border-t border-default flex items-center justify-center gap-2 text-brand hover:text-brand-secondary transition-all group rounded-b-lg hover:bg-secondary/80 backdrop-blur-sm"
				>
					<IconMessageCircle className="w-5 h-5" />
					<span className="font-medium">{t("notification.view_all")}</span>
					<span className="text-xs text-muted group-hover:text-faint">
						{t("notification.unread_suffix", { count: remainingCount })}
					</span>
				</Link>
			</CardSpotlight>
		</div>
	);
}
