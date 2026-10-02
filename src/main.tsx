import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Providers } from "@/components/providers/Providers";
import { CookieConsent } from "@/components/ui/CookieConsent";
import { AppRouter } from "./router";
import "./i18n";
import "./styles/globals.css";

const FabButton = lazy(() =>
	import("@/components/ui/FabButton").then(({ FabButton }) => ({ default: FabButton })),
);
const UnreadReplyNotification = lazy(() =>
	import("@/components/UnreadReplyNotification").then(({ UnreadReplyNotification }) => ({
		default: UnreadReplyNotification,
	})),
);

const root = document.getElementById("root");

if (root) {
	createRoot(root).render(
		<StrictMode>
			<BrowserRouter>
				<ErrorBoundary>
					<Providers>
						<AppRouter />
					</Providers>
					<Suspense fallback={null}>
						<FabButton />
						<UnreadReplyNotification />
					</Suspense>
					<CookieConsent />
				</ErrorBoundary>
			</BrowserRouter>
		</StrictMode>,
	);
}
