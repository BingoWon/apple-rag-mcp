import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import type { ErrorDisplayProps } from "./types";

/**
 * 现代化的错误显示组件
 * 优雅的错误处理和用户反馈
 */
const ErrorDisplay = memo<ErrorDisplayProps>(({ error, onClearError }) => {
	const { t } = useTranslation();

	if (!error) return null;

	return (
		<div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
			<div className="flex items-center justify-between">
				<div className="flex items-center">
					<div className="text-destructive text-sm">{t("chart.load_error", { error })}</div>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onClearError}
					className="text-destructive hover:text-destructive/80"
				>
					✕
				</Button>
			</div>
		</div>
	);
});

ErrorDisplay.displayName = "ErrorDisplay";

export default ErrorDisplay;
