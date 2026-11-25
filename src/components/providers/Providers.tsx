import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

interface ProvidersProps {
	children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
	// 公共样式配置
	const baseStyle = {
		background: "var(--surface)",
		color: "var(--foreground)",
		borderRadius: "8px",
		fontSize: "14px",
		maxWidth: "480px", // 增加宽度以更好地显示较长的反馈消息
		padding: "12px 16px",
		whiteSpace: "pre-line" as const,
	};

	// 单层精致阴影 - 保证整体效果
	const createSingleShadow = (r: number, g: number, b: number) =>
		`0px 3px 6px rgba(${r}, ${g}, ${b}, 0.16)`;

	const shadows = {
		default: "0px 3px 6px rgba(0, 0, 0, 0.2)",
		success: createSingleShadow(34, 197, 94), // 单层绿色阴影
		error: createSingleShadow(239, 68, 68), // 单层红色阴影
		info: createSingleShadow(96, 165, 250), // 单层蓝色阴影
	};

	const createToastConfig = (color: string, shadowType: keyof typeof shadows) => ({
		iconTheme: { primary: color, secondary: "var(--background)" },
		style: {
			...baseStyle,
			border: `2px solid ${color}`,
			boxShadow: shadows[shadowType],
		},
	});

	return (
		<ThemeProvider>
			{children}
			<Toaster
				position="top-right"
				toastOptions={{
					duration: 5000,
					style: {
						...baseStyle,
						border: "1px solid var(--border)",
						boxShadow: shadows.default,
					},
					success: createToastConfig("var(--success)", "success"),
					error: createToastConfig("var(--destructive)", "error"),
					loading: createToastConfig("var(--brand)", "info"),
				}}
			/>
		</ThemeProvider>
	);
}
