import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import LegalTabs from "@/components/legal/LegalTabs";
import { ShootingStars } from "@/components/ui/shooting-stars";
import { StarsBackground } from "@/components/ui/stars-background";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function LegalLayout() {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<div className="min-h-screen bg-primary relative">
				<div className="fixed inset-0 z-0">
					<ShootingStars />
					<StarsBackground />
				</div>
				<div className="relative z-10">
					<nav className="border-b border-default bg-primary/80 backdrop-blur-sm sticky top-0 z-50">
						<div className="max-w-5xl mx-auto px-4 py-4">
							<div className="flex items-center justify-between">
								<Link to="/" className="flex items-center">
									<img
										src="/logo-with-text.svg"
										alt="Apple RAG MCP"
										width={160}
										height={32}
										className="h-8 w-auto"
									/>
								</Link>
								<div className="animate-pulse w-10 h-10 bg-secondary rounded-lg" />
							</div>
						</div>
					</nav>
					<div className="container mx-auto px-4 py-8">
						<div className="max-w-5xl mx-auto">
							<div className="flex justify-center">
								<div className="animate-pulse text-muted">Loading...</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-primary relative">
			<div className="fixed inset-0 z-0">
				<ShootingStars />
				<StarsBackground />
			</div>
			<div className="relative z-10">
				<nav className="border-b border-default bg-primary/80 backdrop-blur-sm sticky top-0 z-50">
					<div className="max-w-5xl mx-auto px-4 py-4">
						<div className="flex items-center justify-between">
							<Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
								<img
									src="/logo-with-text.svg"
									alt="Apple RAG MCP"
									width={160}
									height={32}
									className="h-8 w-auto"
								/>
							</Link>
							<ThemeToggle variant="icon" />
						</div>
					</div>
				</nav>
				<div className="container mx-auto px-4 py-8">
					<div className="max-w-5xl mx-auto">
						<LegalTabs />
					</div>
				</div>
			</div>
			<Outlet />
		</div>
	);
}
