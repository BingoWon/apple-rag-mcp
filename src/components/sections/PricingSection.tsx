import { IconCheck } from "@tabler/icons-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Modal, ModalTrigger } from "@/components/ui/animated-modal";
import { Button } from "@/components/ui/Button";
import { EvervaultCard, Icon } from "@/components/ui/evervault-card";
import { activateFabContact } from "@/components/ui/FabButton";
import { SUPPORTED_CLIENTS } from "@/constants/pricing";
import { trackEvent } from "@/lib/analytics";
import { getPricingTiers } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { PricingModal } from "./PricingModal";

export function PricingSection() {
	const tiers = getPricingTiers();

	// Track pricing section view
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						trackEvent("PRICING_VIEW", {
							section: "pricing_section",
						});
						observer.disconnect(); // Only track once per session
					}
				});
			},
			{ threshold: 0.5 },
		);

		const pricingElement = document.getElementById("pricing");
		if (pricingElement) {
			observer.observe(pricingElement);
		}

		return () => observer.disconnect();
	}, []);

	return (
		<div
			className="mx-auto max-w-7xl px-6 lg:px-8 bg-secondary rounded-xl py-4 sm:py-8"
			id="pricing"
		>
			<div className="text-center">
				<h2 className="text-base font-semibold leading-7 text-brand">Pricing</h2>
				<p className="mt-2 text-3xl font-bold tracking-tight text-light sm:text-4xl">
					Choose the right plan for you
				</p>
				<p className="mt-4 sm:mt-6 text-lg leading-8 text-muted">
					Start free and scale as you grow. All plans include access to our AI-powered MCP.
				</p>
			</div>
			<div className="mx-auto mt-4 sm:mt-10 grid max-w-md grid-cols-1 gap-y-6 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-8 lg:gap-y-0 lg:items-start">
				{tiers.map((tier) => (
					<div key={tier.id} className="border border-default flex flex-col w-full relative">
						{/* Corner Icons */}
						<Icon className="absolute h-6 w-6 -top-3 -left-3 text-light" />
						<Icon className="absolute h-6 w-6 -bottom-3 -left-3 text-light" />
						<Icon className="absolute h-6 w-6 -top-3 -right-3 text-light" />
						<Icon className="absolute h-6 w-6 -bottom-3 -right-3 text-light" />

						{/* EvervaultCard with all pricing content */}
						<EvervaultCard
							className="w-full h-full"
							gradientFrom={tier.gradientFrom}
							gradientTo={tier.gradientTo}
						>
							<div className="flex flex-col justify-between h-full">
								<div>
									<div className="flex items-center justify-between gap-x-4">
										<h3
											id={tier.id}
											className={`text-lg font-semibold leading-8 ${
												tier.popular ? "text-brand" : "text-light"
											}`}
										>
											{tier.name}
										</h3>
										{tier.popular ? (
											<p className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold leading-5 text-brand">
												Most popular
											</p>
										) : null}
									</div>
									<p className="mt-3 sm:mt-4 text-sm leading-6 text-muted">{tier.description}</p>
									<p className="mt-4 sm:mt-6 flex items-baseline gap-x-1">
										<span className="text-4xl font-bold tracking-widest text-light">
											{tier.displayPrice}
										</span>
									</p>
									<ul className="mt-6 sm:mt-8 space-y-2 sm:space-y-3 text-sm leading-6 text-muted">
										{tier.features.map((feature) => (
											<li key={feature} className="flex gap-x-3">
												<IconCheck className="h-6 w-5 flex-none text-brand" aria-hidden="true" />
												{feature}
											</li>
										))}
									</ul>
								</div>
								{tier.action === "contact" ? (
									<Button
										variant={tier.popular ? "primary" : "outline"}
										className="mt-6 sm:mt-8 w-full"
										onClick={activateFabContact}
									>
										Contact us
									</Button>
								) : tier.action === "register" ? (
									<Link to={tier.href}>
										<Button
											variant={tier.popular ? "primary" : "outline"}
											className="mt-6 sm:mt-8 w-full"
										>
											Get started
										</Button>
									</Link>
								) : (
									<Modal>
										<ModalTrigger
											className={cn(
												"mt-6 sm:mt-8 w-full px-4 py-2 rounded-lg text-center relative overflow-hidden transition-all duration-200",
												tier.popular
													? "bg-brand text-white hover:bg-brand/90 shadow-lg hover:shadow-xl"
													: "border border-default bg-transparent text-light hover:bg-secondary hover:border-border-light",
											)}
										>
											Get started
										</ModalTrigger>
										<PricingModal planName={tier.name} />
									</Modal>
								)}
							</div>
						</EvervaultCard>
					</div>
				))}
			</div>

			{/* Supported Clients - Global Section */}
			<div className="mt-4 md:mt-0">
				<h3 className="text-lg font-semibold text-light mb-4">Supported Clients:</h3>
				<p className="text-sm text-muted leading-relaxed">{SUPPORTED_CLIENTS.join(", ")}</p>
			</div>
		</div>
	);
}
