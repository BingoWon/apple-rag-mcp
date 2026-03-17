import { IconAlertTriangle } from "@tabler/icons-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import i18n from "@/i18n";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
	error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
	public state: State = {
		hasError: false,
	};

	public static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("ErrorBoundary caught an error:", error, errorInfo);

		// In production, you might want to log this to an error reporting service
		if (process.env.NODE_ENV === "production") {
			// Example: Sentry.captureException(error, { contexts: { errorInfo } })
		}
	}

	private handleReset = () => {
		this.setState({ hasError: false, error: undefined });
	};

	private handleReload = () => {
		window.location.reload();
	};

	public render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
					<div className="max-w-md w-full space-y-8 text-center">
						<div>
							<div className="mx-auto h-12 w-12 text-red-500">
								<IconAlertTriangle className="h-12 w-12" />
							</div>
							<h2 className="mt-6 text-3xl font-extrabold text-gray-900">
								{i18n.t("errorboundary.title")}
							</h2>
							<p className="mt-2 text-sm text-gray-600">{i18n.t("errorboundary.subtitle")}</p>
							{process.env.NODE_ENV === "development" && this.state.error && (
								<details className="mt-4 text-left">
									<summary className="cursor-pointer text-sm font-medium text-gray-700">
										{i18n.t("errorboundary.details")}
									</summary>
									<pre className="mt-2 text-xs text-red-600 bg-red-50 p-4 rounded overflow-auto">
										{this.state.error.stack}
									</pre>
								</details>
							)}
						</div>
						<div className="space-y-4">
							<Button onClick={this.handleReset} className="w-full">
								{i18n.t("errorboundary.try_again")}
							</Button>
							<Button onClick={this.handleReload} variant="secondary" className="w-full">
								{i18n.t("errorboundary.reload")}
							</Button>
						</div>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

// Hook version for functional components
export function useErrorHandler() {
	return (error: Error, errorInfo?: ErrorInfo) => {
		console.error("Error caught by useErrorHandler:", error, errorInfo);

		if (process.env.NODE_ENV === "production") {
			// Log to error reporting service
		}
	};
}
