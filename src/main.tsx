import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Providers } from "@/components/providers/Providers";
import { UnreadReplyNotification } from "@/components/UnreadReplyNotification";
import { CookieConsent } from "@/components/ui/CookieConsent";
import { FabButton } from "@/components/ui/FabButton";
import { AppRouter } from "./router";
import "./styles/globals.css";

const root = document.getElementById("root");

if (root) {
	createRoot(root).render(
		<StrictMode>
			<BrowserRouter>
				<ErrorBoundary>
					<Providers>
						<AppRouter />
					</Providers>
					<FabButton />
					<CookieConsent />
					<UnreadReplyNotification />
				</ErrorBoundary>
			</BrowserRouter>
		</StrictMode>,
	);
}
