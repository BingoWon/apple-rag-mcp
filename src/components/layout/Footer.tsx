import { IconBrandGithub } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { activateFabContact } from "@/components/ui/FabButton";
import { trackEvent } from "@/lib/analytics";

const navigation = {
	product: [
		{ name: "Features", href: "/#features" },
		{ name: "Pricing", href: "/#pricing" },
		{ name: "Contact", href: "#", action: "contact" },
	],
	dashboard: [
		{ name: "Overview", href: "/overview/" },
		{ name: "MCP Tokens", href: "/mcp-tokens/" },
		{ name: "Authorized IPs", href: "/authorized-ips/" },
		{ name: "Billing", href: "/billing/" },
		{ name: "Usage", href: "/usage/" },
	],
	social: [
		{
			name: "GitHub",
			href: "https://github.com/BingoWon/apple-rag-mcp",
			icon: (props: any) => <IconBrandGithub {...props} />,
		},
		{
			name: "Aceternity UI",
			href: "https://ui.aceternity.com/",
			icon: (props: any) => (
				<img
					src="https://ui.aceternity.com/logo-dark.png"
					alt="Aceternity UI"
					className="h-6 w-6"
					{...props}
				/>
			),
		},
	],
};

export function Footer() {
	return (
		<footer className="bg-background border-t border-border">
			<div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
				<div className="xl:grid xl:grid-cols-3 xl:gap-16">
					<div className="space-y-8">
						<div className="flex items-center">
							<img src="/logo-with-text.svg" alt="Apple RAG MCP" className="h-8 w-auto" />
						</div>
						<p className="text-sm leading-6 text-muted">
							Think Vibe Coding. Where RAG technology meets Model Context Protocol, your AI agents
							don't just code Apple - they master it.
						</p>
						<div className="flex space-x-6">
							{navigation.social.map((item) => (
								<a
									key={item.name}
									href={item.href}
									className="text-muted hover:text-light"
									target="_blank"
									rel="noopener noreferrer"
									onClick={() => {
										if (item.name === "GitHub") {
											trackEvent("GITHUB_CLICK", {
												link_url: item.href,
												location: "footer",
											});
										}
									}}
								>
									<span className="sr-only">{item.name}</span>
									<item.icon className="h-6 w-6" aria-hidden="true" />
								</a>
							))}
						</div>
					</div>
					<div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
						<div>
							<h3 className="text-sm font-semibold leading-6 text-light">Product</h3>
							<ul className="mt-6 space-y-4">
								{navigation.product.map((item) => (
									<li key={item.name}>
										{item.action === "contact" ? (
											<button
												onClick={(e) => {
													e.preventDefault();
													activateFabContact();
												}}
												className="text-sm leading-6 text-muted hover:text-light cursor-pointer"
											>
												{item.name}
											</button>
										) : (
											<Link
												to={item.href}
												className="text-sm leading-6 text-muted hover:text-light"
											>
												{item.name}
											</Link>
										)}
									</li>
								))}
							</ul>
						</div>
						<div>
							<h3 className="text-sm font-semibold leading-6 text-light">Dashboard</h3>
							<ul className="mt-6 space-y-4">
								{navigation.dashboard.map((item) => (
									<li key={item.name}>
										<Link to={item.href} className="text-sm leading-6 text-muted hover:text-light">
											{item.name}
										</Link>
									</li>
								))}
							</ul>
						</div>
					</div>
				</div>
				<div className="mt-16 border-t border-default pt-4 space-y-4">
					<p className="text-xs leading-5 text-muted text-center md:text-left">
						&copy; 2025 Apple RAG MCP • All rights reserved
					</p>
					<div className="flex flex-col items-center space-y-4 md:flex-row md:justify-between md:space-y-0">
						<div className="flex space-x-4 text-xs">
							<Link to="/privacy-policy" className="text-muted hover:text-light">
								Privacy Policy
							</Link>
							<Link to="/terms-of-service" className="text-muted hover:text-light">
								Terms of Service
							</Link>
						</div>
						<p className="text-xs text-muted">Crafted with Vibe Coding ✨</p>
					</div>
				</div>
			</div>
		</footer>
	);
}
