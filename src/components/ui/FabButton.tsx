import { IconArrowsMinimize, IconMessageCircle, IconSend } from "@tabler/icons-react";
import { gsap } from "gsap";
import React from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { isValidEmail } from "@/utils/email";

// 配置常量 - 遵循设计系统规范
const CONFIG = {
	BUTTON: { SIZE: 42, BORDER_RADIUS: "50%" },
	POPOVER: { WIDTH: 380, HEIGHT: 136, BORDER_RADIUS: "6px" },
	SPACING: {
		MARGIN: 24, // 距离屏幕边缘的最小间距
		OFFSET_X: -10, // X轴偏移：负值向左，正值向右
		OFFSET_Y: -10, // Y轴偏移：负值向上，正值向下
	},
	ANIMATION: { duration: 0.35, ease: "power2.inOut" },
} as const;

// 样式常量 - 基于设计系统
const STYLES = {
	// 使用设计系统的阴影变量
	SHADOW_COMPLEX: "shadow-[var(--shadow-complex)]",
	// 分割线样式
	DIVIDER:
		"h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent dark:bg-gradient-to-r dark:from-transparent dark:via-black/20 dark:to-transparent",
	// 输入框基础样式 - 硬编码亮色模式样式
	INPUT_BASE:
		"bg-transparent border-0 outline-0 text-sm font-normal text-gray-900 placeholder-gray-500 placeholder:italic caret-brand",
} as const;

// 类型定义

interface Position {
	left: number;
	top: number;
	x: number;
	y: number;
	xPercent: number;
	yPercent: number;
}

interface FabButtonProps {
	className?: string;
}

// 全局激活函数
export const activateFabContact = () => {
	window.dispatchEvent(new CustomEvent("activateFabContact"));
};

// 分割线组件 - 复用样式
const Divider = () => (
	<div className="relative">
		<div className={STYLES.DIVIDER} />
	</div>
);

// 位置计算工具函数
const calculateOptimalPosition = (buttonRect: DOMRect): Position => {
	const { WIDTH, HEIGHT } = CONFIG.POPOVER;
	const { MARGIN, OFFSET_X, OFFSET_Y } = CONFIG.SPACING;

	// 计算理想位置：以按钮右下角为基准点，加上偏移量
	let left = buttonRect.right + OFFSET_X;
	let top = buttonRect.bottom + OFFSET_Y;

	// 边界约束：确保 Popover 完全在视口内
	left = Math.max(MARGIN, Math.min(left, window.innerWidth - WIDTH - MARGIN));
	top = Math.max(MARGIN, Math.min(top, window.innerHeight - HEIGHT - MARGIN));

	return { left, top, x: 0, y: 0, xPercent: 0, yPercent: 0 };
};

// 动画 Hook
const usePopoverAnimation = (
	buttonRef: React.RefObject<HTMLButtonElement | null>,
	popoverRef: React.RefObject<HTMLDivElement | null>,
	placeholderRef: React.RefObject<HTMLSpanElement | null>,
	contentRef: React.RefObject<HTMLDivElement | null>,
) => {
	const animateOpen = React.useCallback(async () => {
		const elements = [
			buttonRef.current,
			popoverRef.current,
			placeholderRef.current,
			contentRef.current,
		];
		if (elements.some((el) => !el)) return;

		const [button, popover, placeholder, content] = elements;
		const buttonRect = button!.getBoundingClientRect();
		const finalPosition = calculateOptimalPosition(buttonRect);

		const tl = gsap.timeline();
		tl.to(popover, {
			...finalPosition,
			width: CONFIG.POPOVER.WIDTH,
			height: CONFIG.POPOVER.HEIGHT,
			borderRadius: CONFIG.POPOVER.BORDER_RADIUS,
			...CONFIG.ANIMATION,
		})
			.to(placeholder, { opacity: 0.5, ...CONFIG.ANIMATION }, 0)
			.to(content, { opacity: 1, filter: "blur(0px)", ...CONFIG.ANIMATION }, 0);

		await tl;
	}, [buttonRef, popoverRef, placeholderRef, contentRef]);

	const animateClose = React.useCallback(
		async (onComplete?: () => void) => {
			const elements = [
				buttonRef.current,
				popoverRef.current,
				placeholderRef.current,
				contentRef.current,
			];
			if (elements.some((el) => !el)) return;

			const [button, popover, placeholder, content] = elements;
			const buttonRect = button!.getBoundingClientRect();

			const tl = gsap.timeline();
			tl.to(popover, {
				width: buttonRect.width,
				height: buttonRect.height,
				top: buttonRect.top,
				left: buttonRect.left,
				borderRadius: CONFIG.BUTTON.BORDER_RADIUS,
				x: 0,
				y: 0,
				xPercent: 0,
				yPercent: 0,
				...CONFIG.ANIMATION,
			})
				.to(placeholder, { opacity: 1, ...CONFIG.ANIMATION }, 0)
				.to(content, { opacity: 0, filter: "blur(4px)", ...CONFIG.ANIMATION }, 0);

			await tl;
			// 动画完成后调用回调函数
			if (onComplete) onComplete();
		},
		[buttonRef, popoverRef, placeholderRef, contentRef],
	);

	return { animateOpen, animateClose };
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

	// 获取用户认证信息
	const { user, isAuthenticated } = useAuth();

	const { animateOpen, animateClose } = usePopoverAnimation(
		buttonRef,
		popoverRef,
		placeholderRef,
		contentRef,
	);

	const handleClick = React.useCallback(async () => {
		const popover = popoverRef.current;
		const button = buttonRef.current;

		if (!popover || !button || isAnimating) {
			return;
		}

		setIsAnimating(true);

		if (isOpen) {
			await animateClose(() => setIsOpen(false));
		} else {
			setIsOpen(true);
			// 初始化 Popover 位置
			const buttonRect = button.getBoundingClientRect();
			gsap.set(popover, {
				width: buttonRect.width,
				height: buttonRect.height,
				top: buttonRect.top,
				left: buttonRect.left,
				opacity: 1,
				borderRadius: CONFIG.BUTTON.BORDER_RADIUS,
				x: 0,
				y: 0,
				xPercent: 0,
				yPercent: 0,
			});
			await animateOpen();
		}

		setIsAnimating(false);
	}, [isOpen, isAnimating, animateOpen, animateClose]);

	// 自动填充已登录用户的有效邮箱
	React.useEffect(() => {
		if (isAuthenticated && user?.email && isValidEmail(user.email)) {
			setEmail(user.email);
		} else {
			setEmail("");
		}
	}, [isAuthenticated, user?.email]);

	// 键盘快捷键处理
	const handleKeyDown = (e: React.KeyboardEvent) => {
		// Command + Enter (Mac) 或 Ctrl + Enter (Windows/Linux) 提交表单
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			handleSubmit(e as any);
		}
	};

	// 表单提交处理
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!message || isSubmitting) return;

		try {
			setIsSubmitting(true);

			const response = await api.submitContactMessage({
				email: email.trim() || undefined,
				message: message.trim(),
				userId: user?.id || undefined,
			});

			if (response.success) {
				const hasEmail = email?.trim();
				const successMessage = hasEmail
					? t("fab.success_with_email", { email: email.trim() })
					: t("fab.success_no_email");

				toast.success(successMessage, {
					duration: 10000, // 显示10秒，给用户足够时间阅读
				});

				// 清空表单并关闭
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

	// 事件处理 - 简化版，不依赖 Popover API
	React.useEffect(() => {
		const popover = popoverRef.current;
		const button = buttonRef.current;
		if (!popover || !button) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && isOpen) {
				animateClose(() => setIsOpen(false));
			}
		};

		// 监听点击外部事件
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Element;

			// 现代化的 FAB 触发元素识别（使用 data 属性）
			const isFabTriggerElement = target.closest("[data-nav-action='fab-contact']");

			if (
				isOpen &&
				popover &&
				!popover.contains(event.target as Node) &&
				!button.contains(event.target as Node) &&
				!isFabTriggerElement // 排除所有 FAB 触发元素
			) {
				animateClose(() => setIsOpen(false));
			}
		};

		// 监听全局激活事件 - 智能激活逻辑
		const handleGlobalActivate = () => {
			// 如果正在动画中，忽略激活请求
			if (isAnimating) {
				return;
			}

			if (!isOpen) {
				// 如果关闭状态，正常激活
				handleClick();
			} else {
				// 如果已经打开，聚焦到邮箱输入框以提升用户体验
				const emailInput = document.querySelector(
					'#contact-popover input[name="email"]',
				) as HTMLInputElement;
				if (emailInput) {
					emailInput.focus();
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		document.addEventListener("mousedown", handleClickOutside);
		window.addEventListener("activateFabContact", handleGlobalActivate);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			document.removeEventListener("mousedown", handleClickOutside);
			window.removeEventListener("activateFabContact", handleGlobalActivate);
		};
	}, [isOpen, isAnimating, animateClose, handleClick]);

	return (
		<>
			<button
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
					"rounded-md p-1 pointer-events-auto",
					"bg-white text-gray-900 border border-gray-200",
					STYLES.SHADOW_COMPLEX,
				)}
			>
				<span
					ref={placeholderRef}
					className="w-[42px] h-[42px] absolute -bottom-px -left-px grid place-items-center text-gray-900"
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
									aria-label="Close"
									onClick={() => {
										animateClose(() => setIsOpen(false));
									}}
									className="w-8 h-8 rounded-md grid place-items-center p-0 border-0 bg-transparent text-gray-600 hover:text-gray-800 cursor-pointer relative pointer-events-auto"
								>
									<IconArrowsMinimize className="w-5 h-5" />
								</button>
								<button
									type="submit"
									aria-label={t("fab.submit")}
									disabled={isSubmitting || !message.trim()}
									className={cn(
										"w-7 h-7 rounded-md grid place-items-center p-0 border-0 cursor-pointer relative pointer-events-auto",
										isSubmitting || !message.trim()
											? "bg-gray-400 text-gray-200"
											: "bg-gray-900 text-white",
									)}
								>
									<IconSend className="w-5 h-5" />
								</button>
							</div>
						</div>
					</form>
				</div>
			</div>
		</>
	);
}
