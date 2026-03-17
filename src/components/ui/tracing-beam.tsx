import { motion, useScroll, useSpring, useTransform } from "motion/react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

// ==================== 超参数配置 ====================
const TRACING_BEAM_CONFIG = {
	// 渐变坐标控制参数
	INITIAL_Y_POSITION: 150, // 渐变起始位置：距离顶部150px开始显示渐变（您调整的值）
	Y2_END_OFFSET: 100, // 渐变结束偏移：比内容底部提前100px结束，创造淡出效果（您调整的值）
	SCROLL_PROGRESS_Y1_END: 0.8, // Y1停止点：滚动80%时Y1到达终点，与Y2形成动态渐变
	SVG_HEIGHT_RATIO: 0.5, // 路径转折点：在50%高度处路径开始向下弯曲（您调整的值）

	// SVG 尺寸参数
	SVG_WIDTH: 20, // SVG实际显示宽度：在页面上占20px宽度
	SVG_VIEWBOX_WIDTH: 20, // SVG坐标系宽度：内部坐标系20单位宽（1:1比例）

	// 响应式定位参数
	MOBILE_LEFT_OFFSET: "-left-6", // 移动端：向右偏移8px + 额外10px = 18px总偏移
	DESKTOP_LEFT_OFFSET: "md:-left-32", // 桌面端：向左偏移128px，给内容留出更多空间
	TOP_OFFSET: "top-30", // 顶部间距：距离容器顶部12px

	// 动画效果参数
	SPRING_STIFFNESS: 500, // 弹簧刚度：数值越大动画越快速响应
	SPRING_DAMPING: 90, // 弹簧阻尼：数值越大动画越平滑，减少震荡
	DOT_ANIMATION_DURATION: 0.2, // 圆点变色动画时长：0.2秒完成颜色切换
	DOT_ANIMATION_DELAY: 0.5, // 圆点动画延迟：页面加载后0.5秒开始动画
	PATH_ANIMATION_DURATION: 10, // 路径绘制动画时长：10秒完成整条路径绘制

	// 布局样式参数
	CONTAINER_MAX_WIDTH: "max-w-6xl", // 内容容器最大宽度：1152px，保持内容居中
	DOT_OUTER_SIZE: "h-4 w-4", // 外圆点尺寸：16x16px，作为视觉焦点
	DOT_INNER_SIZE: "h-2 w-2", // 内圆点尺寸：8x8px，嵌套在外圆点内

	// 圆点定位参数（响应式）
	MOBILE_DOT_MARGIN: "ml-[17px]", // 移动端圆点左边距：对齐8px曲线偏移
	DESKTOP_DOT_MARGIN: "ml-[27px]", // 桌面端圆点左边距：对齐18px曲线偏移

	// SVG 路径绘制参数（响应式）
	MOBILE: {
		PATH_START_X: 1, // 移动端路径起始X坐标
		PATH_CURVE_OFFSET: 8, // 移动端路径水平偏移：8px形成紧凑曲线
		PATH_CURVE_HEIGHT: 24, // 移动端路径曲线高度：24px的垂直曲线段
		PATH_NEGATIVE_START: -36, // 移动端路径向上延伸：向上延伸36px
	},
	DESKTOP: {
		PATH_START_X: 1, // 桌面端路径起始X坐标
		PATH_CURVE_OFFSET: 18, // 桌面端路径水平偏移：18px形成标准曲线
		PATH_CURVE_HEIGHT: 24, // 桌面端路径曲线高度：24px的垂直曲线段
		PATH_NEGATIVE_START: -36, // 桌面端路径向上延伸：向上延伸36px
	},
};

export const TracingBeam = ({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) => {
	const ref = useRef<HTMLDivElement>(null);
	const { resolvedTheme } = useTheme();
	const isDark = resolvedTheme === "dark";

	const { scrollYProgress } = useScroll({
		target: ref,
		offset: ["start start", "end start"],
	});

	const contentRef = useRef<HTMLDivElement>(null);
	const [svgHeight, setSvgHeight] = useState(0);
	const [isMobile, setIsMobile] = useState(false);

	// 检测屏幕尺寸
	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 768); // md断点是768px
		};

		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	// 根据屏幕尺寸选择配置
	const pathConfig = isMobile ? TRACING_BEAM_CONFIG.MOBILE : TRACING_BEAM_CONFIG.DESKTOP;

	useEffect(() => {
		if (contentRef.current) {
			setSvgHeight(contentRef.current.offsetHeight);
		}
	}, []);

	const y1 = useSpring(
		useTransform(
			scrollYProgress,
			[0, TRACING_BEAM_CONFIG.SCROLL_PROGRESS_Y1_END],
			[TRACING_BEAM_CONFIG.INITIAL_Y_POSITION, svgHeight],
		),
		{
			stiffness: TRACING_BEAM_CONFIG.SPRING_STIFFNESS,
			damping: TRACING_BEAM_CONFIG.SPRING_DAMPING,
		},
	);
	const y2 = useSpring(
		useTransform(
			scrollYProgress,
			[0, 1],
			[TRACING_BEAM_CONFIG.INITIAL_Y_POSITION, svgHeight - TRACING_BEAM_CONFIG.Y2_END_OFFSET],
		),
		{
			stiffness: TRACING_BEAM_CONFIG.SPRING_STIFFNESS,
			damping: TRACING_BEAM_CONFIG.SPRING_DAMPING,
		},
	);

	return (
		<motion.div
			ref={ref}
			className={cn(
				`relative mx-auto h-full w-full ${TRACING_BEAM_CONFIG.CONTAINER_MAX_WIDTH}`,
				className,
			)}
		>
			<div
				className={`absolute ${TRACING_BEAM_CONFIG.TOP_OFFSET} ${TRACING_BEAM_CONFIG.MOBILE_LEFT_OFFSET} ${TRACING_BEAM_CONFIG.DESKTOP_LEFT_OFFSET} z-20`}
				style={isMobile ? { transform: "translateX(10px)" } : {}}
			>
				<motion.div
					transition={{
						duration: TRACING_BEAM_CONFIG.DOT_ANIMATION_DURATION,
						delay: TRACING_BEAM_CONFIG.DOT_ANIMATION_DELAY,
					}}
					animate={{
						boxShadow: scrollYProgress.get() > 0 ? "none" : "var(--shadow-complex)",
					}}
					className={`border-netural-200 ${isMobile ? TRACING_BEAM_CONFIG.MOBILE_DOT_MARGIN : TRACING_BEAM_CONFIG.DESKTOP_DOT_MARGIN} flex ${TRACING_BEAM_CONFIG.DOT_OUTER_SIZE} items-center justify-center rounded-full border shadow-sm`}
				>
					<motion.div
						transition={{
							duration: TRACING_BEAM_CONFIG.DOT_ANIMATION_DURATION,
							delay: TRACING_BEAM_CONFIG.DOT_ANIMATION_DELAY,
						}}
						animate={{
							backgroundColor:
								scrollYProgress.get() > 0 ? "hsl(var(--background))" : "hsl(var(--success))",
							borderColor:
								scrollYProgress.get() > 0 ? "hsl(var(--background))" : "hsl(var(--success))",
						}}
						className={`${TRACING_BEAM_CONFIG.DOT_INNER_SIZE} rounded-full border border-neutral-300 bg-white`}
					/>
				</motion.div>
				<svg
					viewBox={`0 0 ${TRACING_BEAM_CONFIG.SVG_VIEWBOX_WIDTH} ${svgHeight}`}
					width={TRACING_BEAM_CONFIG.SVG_WIDTH}
					height={svgHeight} // Set the SVG height
					className="ml-4 block"
					aria-hidden="true"
				>
					<motion.path
						d={`M ${pathConfig.PATH_START_X} 0V ${pathConfig.PATH_NEGATIVE_START} l ${pathConfig.PATH_CURVE_OFFSET} ${pathConfig.PATH_CURVE_HEIGHT} V ${svgHeight * TRACING_BEAM_CONFIG.SVG_HEIGHT_RATIO} l -${pathConfig.PATH_CURVE_OFFSET} ${pathConfig.PATH_CURVE_HEIGHT}V ${svgHeight}`}
						fill="none"
						stroke={isDark ? "#9091A0" : "#64748b"}
						strokeOpacity="0.16"
						transition={{
							duration: TRACING_BEAM_CONFIG.PATH_ANIMATION_DURATION,
						}}
					></motion.path>
					<motion.path
						d={`M ${pathConfig.PATH_START_X} 0V ${pathConfig.PATH_NEGATIVE_START} l ${pathConfig.PATH_CURVE_OFFSET} ${pathConfig.PATH_CURVE_HEIGHT} V ${svgHeight * TRACING_BEAM_CONFIG.SVG_HEIGHT_RATIO} l -${pathConfig.PATH_CURVE_OFFSET} ${pathConfig.PATH_CURVE_HEIGHT}V ${svgHeight}`}
						fill="none"
						stroke="url(#gradient)"
						strokeWidth="1.25"
						className="motion-reduce:hidden"
						transition={{
							duration: TRACING_BEAM_CONFIG.PATH_ANIMATION_DURATION,
						}}
					></motion.path>
					<defs>
						<motion.linearGradient
							id="gradient"
							gradientUnits="userSpaceOnUse"
							x1="0"
							x2="0"
							y1={y1} // set y1 for gradient
							y2={y2} // set y2 for gradient
						>
							<stop stopColor="#18CCFC" stopOpacity="0"></stop>
							<stop stopColor="#18CCFC"></stop>
							<stop offset="0.325" stopColor="#6344F5"></stop>
							<stop offset="1" stopColor="#AE48FF" stopOpacity="0"></stop>
						</motion.linearGradient>
					</defs>
				</svg>
			</div>
			<div ref={contentRef}>{children}</div>
		</motion.div>
	);
};
