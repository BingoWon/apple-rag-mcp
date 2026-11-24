import { IconAlertTriangle, IconCheck, IconCopy, IconHome, IconRefresh } from "@tabler/icons-react";
import { Component, type ErrorInfo, type ReactNode, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import {
	APP_VERSION,
	isChunkLoadError,
	isDeploymentReloading,
	recoverFromStaleDeployment,
} from "@/lib/deployment-recovery";

export interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: ReactNode;
	resetKey?: string;
	scope?: "root" | "page";
}

interface State {
	hasError: boolean;
	error?: Error;
}

const isDev = Boolean(import.meta.env?.DEV);

function formatErrorSummary(error: Error): string {
	const header = `${error.name || "Error"}: ${error.message || "Unknown error"}`;
	if (isDev && error.stack) {
		return error.stack;
	}
	return header;
}

export function ErrorFallback({
	error,
	scope = "root",
	onReset,
	onReload,
}: {
	error?: Error;
	scope?: "root" | "page";
	onReset: () => void;
	onReload: () => void;
}) {
	const { t } = useTranslation();
	const [copied, setCopied] = useState(false);

	const chunkError = isChunkLoadError(error);
	const Heading = scope === "root" ? "h1" : "h2";
	const detailText = error ? formatErrorSummary(error) : "";
	const wrapperClass =
		scope === "root"
			? "flex min-h-dvh w-full items-center justify-center bg-background px-4 py-12 text-foreground"
			: "flex min-h-[55vh] w-full items-center justify-center px-4 py-12 text-foreground";

	const handleCopy = async () => {
		if (!detailText || typeof navigator === "undefined" || !navigator.clipboard) return;
		const path = typeof window !== "undefined" ? window.location.pathname : "";
		const payload = `[Apple RAG v${APP_VERSION}] ${path}\n${detailText}`;
		try {
			await navigator.clipboard.writeText(payload);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {}
	};

	return (
		<div className={wrapperClass} role="alert">
			<div className="w-full max-w-md rounded-2xl border border-default bg-card p-6 text-center shadow-[var(--shadow-complex)] sm:p-8">
				<div
					className={
						chunkError
							? "mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-brand/25 bg-brand/10 text-brand"
							: "mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-error/25 bg-error/10 text-error"
					}
				>
					{chunkError ? (
						<IconRefresh className="h-6 w-6" aria-hidden="true" />
					) : (
						<IconAlertTriangle className="h-6 w-6" aria-hidden="true" />
					)}
				</div>

				<Heading className="mt-5 text-xl font-semibold tracking-tight text-light sm:text-2xl">
					{t(chunkError ? "errorboundary.update_title" : "errorboundary.title")}
				</Heading>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
					{t(chunkError ? "errorboundary.update_subtitle" : "errorboundary.subtitle")}
				</p>

				<div className="mt-6 space-y-3">
					<Button onClick={onReload} variant="primary" className="w-full">
						<IconRefresh className="h-4 w-4 shrink-0" aria-hidden="true" />
						<span>{t(chunkError ? "errorboundary.reload_update" : "errorboundary.reload")}</span>
					</Button>

					<div className={chunkError ? "flex justify-center" : "grid grid-cols-2 gap-3"}>
						{!chunkError && (
							<Button onClick={onReset} variant="outline" className="w-full">
								{t("errorboundary.try_again")}
							</Button>
						)}
						<Button asChild variant="outline" className="w-full">
							<a href="/">
								<IconHome className="h-4 w-4 shrink-0" aria-hidden="true" />
								<span>{t("errorboundary.back_home")}</span>
							</a>
						</Button>
					</div>
				</div>

				{detailText && (
					<details className="mt-6 rounded-xl border border-default bg-secondary text-left">
						<summary className="flex cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-medium text-muted-foreground select-none hover:text-light">
							<span>{t("errorboundary.details")}</span>
							<span className="font-mono text-[11px] opacity-75">v{APP_VERSION}</span>
						</summary>
						<div className="border-t border-default px-3.5 py-3">
							<div className="mb-2 flex justify-end">
								<button
									type="button"
									onClick={handleCopy}
									className="inline-flex items-center gap-1 rounded-md border border-default bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-tertiary hover:text-light"
								>
									{copied ? (
										<IconCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
									) : (
										<IconCopy className="h-3.5 w-3.5" aria-hidden="true" />
									)}
									<span>{t(copied ? "errorboundary.copied" : "errorboundary.copy_details")}</span>
								</button>
							</div>
							<pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-muted-foreground">
								{detailText}
							</pre>
						</div>
					</details>
				)}
			</div>
		</div>
	);
}

function LoadingState({ scope = "root" }: { scope?: "root" | "page" }) {
	const { t } = useTranslation();
	const wrapperClass =
		scope === "root"
			? "flex min-h-dvh w-full items-center justify-center bg-background text-sm text-muted-foreground"
			: "flex min-h-[55vh] w-full items-center justify-center text-sm text-muted-foreground";
	return (
		<div className={wrapperClass} role="status">
			{t("common.loading")}
		</div>
	);
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
	public state: State = {
		hasError: false,
	};

	public static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		if (isChunkLoadError(error) && recoverFromStaleDeployment()) {
			return;
		}
		console.error("ErrorBoundary caught an error:", error, errorInfo);
	}

	public componentDidUpdate(prevProps: ErrorBoundaryProps) {
		if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
			this.setState({ hasError: false, error: undefined });
		}
	}

	private handleReset = () => {
		this.setState({ hasError: false, error: undefined });
	};

	private handleReload = () => {
		window.location.reload();
	};

	public render() {
		if (!this.state.hasError) {
			return this.props.children;
		}

		const scope = this.props.scope ?? "root";

		if (isDeploymentReloading()) {
			return <LoadingState scope={scope} />;
		}

		if (this.props.fallback) {
			return this.props.fallback;
		}

		return (
			<ErrorFallback
				error={this.state.error}
				scope={scope}
				onReset={this.handleReset}
				onReload={this.handleReload}
			/>
		);
	}
}

export function RouteErrorBoundary({
	children,
	fallback,
	scope = "root",
}: Omit<ErrorBoundaryProps, "resetKey">) {
	const { pathname } = useLocation();
	const content =
		scope === "page" ? (
			<Suspense fallback={<LoadingState scope="page" />}>{children}</Suspense>
		) : (
			children
		);
	return (
		<ErrorBoundary resetKey={pathname} scope={scope} fallback={fallback}>
			{content}
		</ErrorBoundary>
	);
}
