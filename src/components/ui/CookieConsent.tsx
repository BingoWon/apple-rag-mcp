import { IconCookie } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Modern Cookie Consent Banner
 * GDPR compliant with elegant design
 */
export function CookieConsent() {
	const [isVisible, setIsVisible] = useState(false);
	const [isLoaded, setIsLoaded] = useState(false);

	useEffect(() => {
		// Check if user has already made a choice
		const consent = localStorage.getItem("cookie-consent");
		if (!consent) {
			setIsVisible(true);
		}
		setIsLoaded(true);
	}, []);

	const handleAccept = () => {
		localStorage.setItem("cookie-consent", "accepted");
		setIsVisible(false);

		// Enable Google Analytics
		if (typeof window !== "undefined" && window.gtag) {
			window.gtag("consent", "update", {
				analytics_storage: "granted",
				ad_storage: "granted",
			});
		}
	};

	const handleDecline = () => {
		localStorage.setItem("cookie-consent", "declined");
		setIsVisible(false);

		// Disable Google Analytics
		if (typeof window !== "undefined" && window.gtag) {
			window.gtag("consent", "update", {
				analytics_storage: "denied",
				ad_storage: "denied",
			});
		}
	};

	if (!isLoaded) return null;

	return (
		<AnimatePresence>
			{isVisible && (
				<motion.div
					initial={{ y: 100, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					exit={{ y: 100, opacity: 0 }}
					transition={{ duration: 0.3, ease: "easeOut" }}
					className="fixed bottom-4 left-4 right-4 z-50 flex justify-center"
				>
					<div className="relative overflow-hidden rounded-xl border border-border bg-background shadow-lg">
						<div className="absolute inset-0 bg-gradient-to-r from-brand/5 to-brand-secondary/5" />

						<div className="relative px-2.5 py-2">
							<div className="flex flex-col sm:flex-row sm:items-center gap-4">
								{/* Icon & Text */}
								<div className="flex items-center gap-3 flex-1 min-w-0">
									<div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
										<IconCookie className="w-5 h-5 text-brand" />
									</div>
									<p className="text-sm text-foreground leading-relaxed">
										We use cookies to personalize your site experience and analyze the site traffic.
									</p>
								</div>

								{/* Buttons */}
								<div className="flex gap-3 flex-shrink-0">
									<Button
										onClick={handleDecline}
										variant="secondary"
										size="sm"
										className="flex-1 sm:flex-none whitespace-nowrap h-8"
									>
										Decline
									</Button>
									<Button
										onClick={handleAccept}
										variant="primary"
										size="sm"
										className="flex-1 px-4 font-bold sm:flex-none whitespace-nowrap h-8"
									>
										Accept
									</Button>
								</div>
							</div>
						</div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

// Initialize consent mode before GA loads
export function initializeConsent() {
	if (typeof window !== "undefined" && window.gtag) {
		const consent = localStorage.getItem("cookie-consent");

		window.gtag("consent", "default", {
			analytics_storage: consent === "accepted" ? "granted" : "denied",
			ad_storage: consent === "accepted" ? "granted" : "denied",
			wait_for_update: 500,
		});
	}
}
