import { IconCopy, IconMail, IconMailOff, IconSend, IconX } from "@tabler/icons-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { formatDateCompact } from "@/lib/datetime";

interface ContactMessage {
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

interface MessageReplyDialogProps {
	message: ContactMessage;
	onClose: () => void;
	onSuccess: () => void;
}

export function MessageReplyDialog({ message, onClose, onSuccess }: MessageReplyDialogProps) {
	const [reply, setReply] = useState(message.admin_reply || "");
	const [sendEmail, setSendEmail] = useState(!!message.email); // Default to true if email available
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Check if message has already been replied to
	const isAlreadyReplied = !!message.admin_reply;

	const handleCopyMessage = () => {
		navigator.clipboard.writeText(message.message);
		toast.success("Message copied to clipboard");
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!reply.trim()) {
			toast.error("Reply message cannot be empty");
			return;
		}

		if (sendEmail && !message.email) {
			toast.error("Cannot send email: user did not provide email address");
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await api.replyToContactMessage(message.id, {
				message: reply.trim(),
				sendEmail,
			});

			if (response.success) {
				toast.success(
					sendEmail
						? "Reply sent successfully! Email notification sent."
						: "Reply saved successfully!",
				);
				onSuccess();
				onClose();
			} else {
				toast.error(response.error?.message || "Failed to send reply");
			}
		} catch (error) {
			console.error("Error sending reply:", error);
			toast.error("Failed to send reply. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
			<div className="bg-elevated rounded-lg shadow-complex max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col border border-default">
				{/* Header */}
				<div className="flex items-center justify-between p-6 border-b border-default">
					<h2 className="text-xl font-bold text-light">
						{isAlreadyReplied ? "View Message & Reply" : "Reply to Message"}
					</h2>
					<button
						onClick={onClose}
						className="p-2 hover:bg-tertiary rounded-lg transition-colors text-muted hover:text-light"
						aria-label="Close"
					>
						<IconX className="w-5 h-5" />
					</button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-6 space-y-6 bg-primary">
					{/* User Info */}
					<div className="bg-secondary rounded-lg p-4 space-y-2 border border-default">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted">From</p>
								<p className="font-medium text-light">{message.email || "Anonymous"}</p>
							</div>
							<div className="text-right">
								<p className="text-sm text-muted">Date</p>
								<p className="font-medium text-light">{formatDateCompact(message.created_at)}</p>
							</div>
						</div>
						{message.ip_address && (
							<div>
								<p className="text-sm text-muted">IP Address</p>
								<p className="font-mono text-sm text-light">{message.ip_address}</p>
							</div>
						)}
						{message.user_id && (
							<div>
								<p className="text-sm text-muted">User ID</p>
								<p className="font-mono text-sm text-light">{message.user_id}</p>
							</div>
						)}
					</div>

					{/* Original Message */}
					<div>
						<div className="flex items-center justify-between mb-2">
							<p className="text-sm font-semibold text-subtle">Original Message:</p>
							<Button variant="ghost" size="sm" onClick={handleCopyMessage}>
								<IconCopy className="w-3.5 h-3.5 mr-1.5" />
								Copy
							</Button>
						</div>
						<div className="bg-secondary rounded-lg p-4 border-l-4 border-default">
							<p className="text-light whitespace-pre-wrap">{message.message}</p>
						</div>
					</div>

					{/* Reply Section */}
					{isAlreadyReplied ? (
						/* View Mode - Already Replied */
						<div>
							<div className="flex items-center justify-between mb-2">
								<p className="text-sm font-semibold text-subtle">
									Admin Reply ({formatDateCompact(message.replied_at!)}):
								</p>
								{message.user_read_at && (
									<span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
										✓ Read by user on {formatDateCompact(message.user_read_at)}
									</span>
								)}
							</div>
							<div className="bg-brand/10 rounded-lg p-4 border-l-4 border-brand">
								<p className="text-light whitespace-pre-wrap">{message.admin_reply}</p>
							</div>
						</div>
					) : (
						/* Edit Mode - New Reply */
						<form onSubmit={handleSubmit} className="space-y-4">
							<div>
								<label htmlFor="reply" className="block text-sm font-semibold text-subtle mb-2">
									Your Reply:
								</label>
								<textarea
									id="reply"
									value={reply}
									onChange={(e) => setReply(e.target.value)}
									className="w-full h-40 px-4 py-3 border border-input rounded-lg focus:ring-2 focus:ring-focus focus:border-transparent bg-secondary text-light resize-none shadow-input transition-colors"
									placeholder="Type your reply here..."
									disabled={isSubmitting}
								/>
							</div>

							{/* Email Notification Toggle */}
							{message.email ? (
								<div className="flex items-center justify-between p-4 bg-brand/10 rounded-lg border border-brand/30">
									<div className="flex items-center gap-3">
										{sendEmail ? (
											<IconMail className="w-5 h-5 text-brand" />
										) : (
											<IconMailOff className="w-5 h-5 text-muted" />
										)}
										<div>
											<p className="text-sm font-semibold text-subtle">
												{sendEmail ? "Email will be sent" : "In-app only"}
											</p>
											<p className="text-xs text-muted">
												{sendEmail ? (
													<>To: {message.email}</>
												) : (
													"User will see reply when they login"
												)}
											</p>
										</div>
									</div>
									<button
										type="button"
										onClick={() => setSendEmail(!sendEmail)}
										disabled={isSubmitting}
										className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${
											sendEmail ? "bg-brand" : "bg-gray-300 dark:bg-gray-600"
										}`}
										role="switch"
										aria-checked={sendEmail}
									>
										<span
											className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
												sendEmail ? "translate-x-6" : "translate-x-1"
											}`}
										/>
									</button>
								</div>
							) : (
								<div className="flex items-center gap-3 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-default">
									<IconMailOff className="w-5 h-5 text-muted" />
									<div>
										<p className="text-sm font-semibold text-muted">Email Unavailable</p>
										<p className="text-xs text-faint">User did not provide email</p>
									</div>
								</div>
							)}
						</form>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-3 p-6 border-t border-default bg-secondary">
					{isAlreadyReplied ? (
						/* View Mode - Only Close Button */
						<Button variant="primary" onClick={onClose}>
							Close
						</Button>
					) : (
						/* Edit Mode - Cancel and Send Buttons */
						<>
							<Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
								Cancel
							</Button>
							<Button
								variant="primary"
								onClick={handleSubmit}
								disabled={isSubmitting || !reply.trim()}
								loading={isSubmitting}
							>
								<IconSend className="w-4 h-4 mr-2" />
								Send Reply
							</Button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
