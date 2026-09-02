import { IconMessageCircle, IconSend, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { isValidEmail } from "@/utils/email";

interface FabButtonProps {
	className?: string;
}

export function FabButton({ className }: FabButtonProps) {
	const { t } = useTranslation();
	const { user, isAuthenticated } = useAuth();
	const [isOpen, setIsOpen] = useState(false);
	const [email, setEmail] = useState("");
	const [message, setMessage] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const emailRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setEmail(isAuthenticated && user?.email && isValidEmail(user.email) ? user.email : "");
	}, [isAuthenticated, user?.email]);

	useEffect(() => {
		const handleActivate = () => {
			setIsOpen(true);
			requestAnimationFrame(() => emailRef.current?.focus());
		};
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") setIsOpen(false);
		};

		window.addEventListener("activateFabContact", handleActivate);
		window.addEventListener("keydown", handleEscape);
		return () => {
			window.removeEventListener("activateFabContact", handleActivate);
			window.removeEventListener("keydown", handleEscape);
		};
	}, []);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!message.trim() || isSubmitting) return;

		setIsSubmitting(true);
		try {
			const response = await api.submitContactMessage({
				email: email.trim() || undefined,
				message: message.trim(),
				userId: user?.id,
			});

			if (!response.success) {
				throw new Error(response.error?.message || t("fab.send_error"));
			}

			toast.success(
				email.trim()
					? t("fab.success_with_email", { email: email.trim() })
					: t("fab.success_no_email"),
			);
			setMessage("");
			if (!isAuthenticated) setEmail("");
			setIsOpen(false);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t("fab.network_error"));
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
			<button
				type="button"
				aria-label={t("fab.label")}
				onClick={() => setIsOpen(true)}
				className={cn(
					"fixed bottom-6 right-6 z-50 grid size-[42px] place-items-center rounded-full",
					"border border-black/15 bg-black text-white shadow-lg transition-transform hover:scale-105",
					"dark:border-white/15 dark:bg-white dark:text-black md:bottom-16 md:right-16",
					className,
				)}
			>
				<IconMessageCircle className="size-6" />
			</button>

			{isOpen && (
				<div className="fixed inset-0 z-50">
					<button
						type="button"
						className="absolute inset-0 size-full bg-black/20"
						onClick={() => setIsOpen(false)}
						aria-label="Close contact form"
					/>
					<form
						onSubmit={handleSubmit}
						className="fixed bottom-20 right-4 z-10 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-gray-200 bg-white text-gray-900 shadow-2xl md:bottom-28 md:right-16"
					>
						<div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
							<span className="font-medium">{t("fab.label")}</span>
							<button
								type="button"
								onClick={() => setIsOpen(false)}
								aria-label="Close"
								className="text-gray-500 hover:text-gray-900"
							>
								<IconX className="size-5" />
							</button>
						</div>

						<div className="space-y-3 p-4">
							<input
								ref={emailRef}
								type="email"
								name="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								placeholder={t("fab.email_placeholder")}
								autoComplete="email"
								className="h-10 w-full rounded-md border border-gray-300 px-3 outline-none focus:border-brand"
							/>
							<textarea
								name="message"
								value={message}
								onChange={(event) => setMessage(event.target.value)}
								placeholder={t("fab.message_placeholder")}
								disabled={isSubmitting}
								className="h-28 w-full resize-none rounded-md border border-gray-300 p-3 outline-none focus:border-brand"
							/>
							<button
								type="submit"
								disabled={isSubmitting || !message.trim()}
								className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gray-900 text-white disabled:cursor-not-allowed disabled:opacity-50"
							>
								<IconSend className="size-4" />
								{t("fab.submit")}
							</button>
						</div>
					</form>
				</div>
			)}
		</>
	);
}
