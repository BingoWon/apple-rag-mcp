import { IconArrowsMinimize, IconMessageCircle, IconSend } from "@tabler/icons-react";
import React from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { isValidEmail } from "@/utils/email";

const CONFIG = {
	BUTTON: { SIZE: 42, BORDER_RADIUS: "50%" },
	POPOVER: { WIDTH: 380, HEIGHT: 144, BORDER_RADIUS: "10px" },
	SPACING: {
		MARGIN: 24,
		OFFSET_X: -10,
		OFFSET_Y: -10,
	},
	ANIMATION: { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
} as const;

const STYLES = {
	SHADOW_COMPLEX: "shadow-[var(--shadow-complex)]",
	DIVIDER: "h-px w-full bg-gradient-to-r from-transparent via-border to-transparent",
	INPUT_BASE:
		"bg-transparent border-0 outline-0 text-sm font-normal text-foreground placeholder:text-muted-foreground placeholder:italic caret-brand",
} as const;

interface Position {
	left: number;
	top: number;
}

interface FabButtonProps {
	className?: string;
}

export const activateFabContact = () => {
	window.dispatchEvent(new CustomEvent("activateFabContact"));
};

const Divider = () => (
	<div className="relative">
		<div className={STYLES.DIVIDER} />
	</div>
);

const calculateOptimalPosition = (buttonRect: DOMRect): Position => {
	const width = Math.min(CONFIG.POPOVER.WIDTH, window.innerWidth - CONFIG.SPACING.MARGIN * 2);
	const { HEIGHT } = CONFIG.POPOVER;
	const { MARGIN, OFFSET_X, OFFSET_Y } = CONFIG.SPACING;

	let left = buttonRect.right + OFFSET_X;
	let top = buttonRect.bottom + OFFSET_Y;

	left = Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN));
	top = Math.max(MARGIN, Math.min(top, window.innerHeight - HEIGHT - MARGIN));

	return { left, top };
};

const runTransition = async (
	el: HTMLElement | null,
	keyframes: Keyframe[],
	options: KeyframeAnimationOptions,
) => {
	if (!el) return;
	if (typeof el.animate !== "function") return;
	try {
		const animation = el.animate(keyframes, { ...options, fill: "forwards" });
		await animation.finished;
		animation.commitStyles?.();
		animation.cancel();
	} catch {
		// Ignore cancelled animations or reduced-motion environments
	}
};

export function FabButton({ className }: FabButtonProps) {
	const [isOpen, setIsOpen] = React.useState(false);
	const [isAnimating, setIsAnimating] = React.useState(false);
	const [email, setEmail] = React.useState("");
	const [message, setMessage] = React.useState("");
	const [isSubmitting, setIsSubmitting] = React.useState(false);
	const { t } = useTranslation();

	const buttonRef = React.useRef<HTMLButtonElement>(null);
	const popoverRef = React.useRef<HTMLDivElement>(null);
	const placeholderRef = React.useRef<HTMLSpanElement>(null);
	const contentRef = React.useRef<HTMLDivElement>(null);
	const formRef = React.useRef<HTMLFormElement>(null);

	const { user, isAuthenticated } = useAuth();

	const animateOpen = React.useCallback(async () => {
		const button = buttonRef.current;
		const popover = popoverRef.current;
		const placeholder = placeholderRef.current;
		const content = contentRef.current;
		if (!button || !popover || !placeholder || !content) return;

		const rect = button.getBoundingClientRect();
		const finalPosition = calculateOptimalPosition(rect);
		const finalWidth = Math.min(
			CONFIG.POPOVER.WIDTH,
			window.innerWidth - CONFIG.SPACING.MARGIN * 2,
		);

		popover.style.display = "block";
		popover.style.opacity = "1";

		await Promise.all([
			runTransition(
				popover,
				[
					{
						top: `${rect.top}px`,
						left: `${rect.left}px`,
						width: `${rect.width}px`,
						height: `${rect.height}px`,
						borderRadius: CONFIG.BUTTON.BORDER_RADIUS,
					},
					{
						top: `${finalPosition.top}px`,
						left: `${finalPosition.left}px`,
						width: `${finalWidth}px`,
						height: `${CONFIG.POPOVER.HEIGHT}px`,
						borderRadius: CONFIG.POPOVER.BORDER_RADIUS,
					},
				],
				CONFIG.ANIMATION,
			),
			runTransition(placeholder, [{ opacity: 1 }, { opacity: 0.45 }], CONFIG.ANIMATION),
			runTransition(
				content,
				[
					{ opacity: 0, filter: "blur(4px)" },
					{ opacity: 1, filter: "blur(0px)" },
				],
				CONFIG.ANIMATION,
			),
		]);

		popover.style.top = `${finalPosition.top}px`;
		popover.style.left = `${finalPosition.left}px`;
		popover.style.width = `${finalWidth}px`;
		popover.style.height = `${CONFIG.POPOVER.HEIGHT}px`;
		popover.style.borderRadius = CONFIG.POPOVER.BORDER_RADIUS;
		placeholder.style.opacity = "0.45";
		content.style.opacity = "1";
		content.style.filter = "blur(0px)";
	}, []);

	const animateClose = React.useCallback(async (onComplete?: () => void) => {
		const button = buttonRef.current;
		const popover = popoverRef.current;
		const placeholder = placeholderRef.current;
		const content = contentRef.current;
		if (!button || !popover || !placeholder || !content) {
			onComplete?.();
			return;
		}

		const rect = button.getBoundingClientRect();
		const current = popover.getBoundingClientRect();

		await Promise.all([
			runTransition(
				popover,
				[
					{
						top: `${current.top}px`,
						left: `${current.left}px`,
						width: `${current.width}px`,
						height: `${current.height}px`,
						borderRadius: CONFIG.POPOVER.BORDER_RADIUS,
					},
					{
						top: `${rect.top}px`,
						left: `${rect.left}px`,
						width: `${rect.width}px`,
						height: `${rect.height}px`,
						borderRadius: CONFIG.BUTTON.BORDER_RADIUS,
					},
				],
				CONFIG.ANIMATION,
			),
			runTransition(placeholder, [{ opacity: 0.45 }, { opacity: 1 }], CONFIG.ANIMATION),
			runTransition(
				content,
				[
					{ opacity: 1, filter: "blur(0px)" },
					{ opacity: 0, filter: "blur(4px)" },
				],
				CONFIG.ANIMATION,
			),
		]);

		popover.style.opacity = "0";
		content.style.opacity = "0";
		content.style.filter = "blur(4px)";
		onComplete?.();
	}, []);

	const handleClick = React.useCallback(async () => {
		if (!popoverRef.current || !buttonRef.current || isAnimating) return;

		setIsAnimating(true);
		if (isOpen) {
			await animateClose(() => setIsOpen(false));
		} else {
			setIsOpen(true);
			await animateOpen();
		}
		setIsAnimating(false);
	}, [isOpen, isAnimating, animateOpen, animateClose]);

	React.useEffect(() => {
		if (isAuthenticated && user?.email && isValidEmail(user.email)) {
			setEmail(user.email);
		} else {
			setEmail("");
		}
	}, [isAuthenticated, user?.email]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			handleSubmit(e as unknown as React.FormEvent);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!message.trim() || isSubmitting) return;

		try {
			setIsSubmitting(true);

			const response = await api.submitContactMessage({
				email: email.trim() || undefined,
				message: message.trim(),
			});

			if (response.success) {
				const hasEmail = email?.trim();
				const successMessage = hasEmail
					? t("fab.success_with_email", { email: email.trim() })
					: t("fab.success_no_email");

				toast.success(successMessage, { duration: 10000 });

				setMessage("");
				if (!isAuthenticated) {
					setEmail("");
				}
				await animateClose(() => setIsOpen(false));
			} else {
				const errorMessage = response.error?.message || t("fab.send_error");
				toast.error(`${t("fab.send_error")}\n${errorMessage}`);
			}
		} catch (error) {
			console.error("Error submitting contact message:", error);
			toast.error(t("fab.network_error"));
		} finally {
			setIsSubmitting(false);
		}
	};

	React.useEffect(() => {
		const popover = popoverRef.current;
		const button = buttonRef.current;
		if (!popover || !button) return;

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape" && isOpen) {
				animateClose(() => setIsOpen(false));
			}
		};

		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Element;
			const isFabTriggerElement = target.closest("[data-nav-action='fab-contact']");

			if (
				isOpen &&
				popover &&
				!popover.contains(event.target as Node) &&
				!button.contains(event.target as Node) &&
				!isFabTriggerElement
			) {
				animateClose(() => setIsOpen(false));
			}
		};

		const handleGlobalActivate = () => {
			if (isAnimating) return;

			if (!isOpen) {
				handleClick();
			} else {
				const emailInput = document.querySelector(
					'#contact-popover input[name="email"]',
				) as HTMLInputElement;
				emailInput?.focus();
			}
		};

		window.addEventListener("keydown", handleEscape);
		document.addEventListener("mousedown", handleClickOutside);
		window.addEventListener("activateFabContact", handleGlobalActivate);

		return () => {
			window.removeEventListener("keydown", handleEscape);
			document.removeEventListener("mousedown", handleClickOutside);
			window.removeEventListener("activateFabContact", handleGlobalActivate);
		};
	}, [isOpen, isAnimating, animateClose, handleClick]);

	return (
		<>
			<button
				type="button"
				ref={buttonRef}
				aria-label={t("fab.label")}
				onClick={handleClick}
				className={cn(
					"w-[42px] h-[42px] rounded-full fixed bottom-6 right-6 md:bottom-16 md:right-16",
					"grid place-items-center p-0 cursor-pointer pointer-events-auto z-50",
					"bg-black dark:bg-white text-white dark:text-black",
					"border border-black/15 dark:border-white/15",
					STYLES.SHADOW_COMPLEX,
					className,
				)}
			>
				<IconMessageCircle className="w-6 h-6" />
			</button>

			<div
				ref={popoverRef}
				id="contact-popover"
				style={{
					position: "fixed",
					width: CONFIG.POPOVER.WIDTH,
					maxWidth: "calc(100vw - 2rem)",
					height: CONFIG.POPOVER.HEIGHT,
					margin: 0,
					inset: "unset",
					opacity: 0,
					display: isOpen ? "block" : "none",
					zIndex: 1000,
				}}
				className={cn(
					"rounded-lg p-1.5 pointer-events-auto overflow-hidden",
					"bg-card text-foreground border border-border",
					STYLES.SHADOW_COMPLEX,
				)}
			>
				<span
					ref={placeholderRef}
					aria-hidden="true"
					className="w-[42px] h-[42px] absolute -bottom-px -left-px grid place-items-center text-muted-foreground"
				>
					<IconMessageCircle className="w-6 h-6" />
				</span>

				<div ref={contentRef} className="h-full w-full" style={{ opacity: 0, filter: "blur(4px)" }}>
					<form
						ref={formRef}
						className="flex flex-col gap-1 h-full w-full"
						onSubmit={handleSubmit}
						onKeyDown={handleKeyDown}
					>
						<input
							type="email"
							placeholder={t("fab.email_placeholder")}
							name="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							autoComplete="email"
							spellCheck={false}
							className={cn("w-full h-8 px-2 rounded-sm", STYLES.INPUT_BASE)}
						/>

						<Divider />

						<textarea
							placeholder={t("fab.message_placeholder")}
							name="message"
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							autoComplete="off"
							spellCheck={false}
							disabled={isSubmitting}
							className={cn(
								"w-full h-16 px-2 py-2 rounded-sm resize-none leading-4",
								STYLES.INPUT_BASE,
							)}
						/>

						<Divider />

						<div className="flex items-center justify-between h-8 pl-8 w-full">
							<div className="flex items-center gap-2 ml-auto">
								<button
									type="button"
									aria-label={t("common.close")}
									onClick={() => {
										animateClose(() => setIsOpen(false));
									}}
									className="w-8 h-8 rounded-md grid place-items-center p-0 border-0 bg-transparent text-muted-foreground hover:text-foreground cursor-pointer relative pointer-events-auto"
								>
									<IconArrowsMinimize className="w-5 h-5" />
								</button>
								<button
									type="submit"
									aria-label={t("fab.submit")}
									disabled={isSubmitting || !message.trim()}
									className={cn(
										"w-7 h-7 rounded-md grid place-items-center p-0 border-0 cursor-pointer relative pointer-events-auto transition-colors",
										isSubmitting || !message.trim()
											? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
											: "bg-foreground text-background hover:opacity-90",
									)}
								>
									<IconSend className="w-4 h-4" />
								</button>
							</div>
						</div>
					</form>
				</div>
			</div>
		</>
	);
}
