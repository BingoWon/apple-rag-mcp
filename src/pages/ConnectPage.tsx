import { Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AgentSetupCard } from "@/components/agent/AgentSetupCard";
import { Footer } from "@/components/layout/Footer";
import { AgentFAQ } from "@/components/sections/AgentFAQ";
import { Button } from "@/components/ui/Button";
import { AppNavbar } from "@/components/ui/resizable-navbar";
import { usePageScroll } from "@/hooks/usePageScroll";
import { lazyWithRecovery } from "@/lib/deployment-recovery";

const commands =
	'npm install -g apple-rag-cli\napple-rag auth login\napple-rag search "SwiftUI NavigationStack path binding" --limit 3 --json\napple-rag browse --json\napple-rag fetch "https://developer.apple.com/documentation/swiftui" --json';

const plainCommands = (
	<pre className="overflow-x-auto rounded-lg bg-secondary p-4 text-sm">{commands}</pre>
);

const CodeBlock = lazyWithRecovery(() =>
	import("@/components/ui/code-block").then(({ CodeBlock }) => ({ default: CodeBlock })),
);

export default function ConnectPage() {
	const { t } = useTranslation();
	const [referenceOpen, setReferenceOpen] = useState(false);
	usePageScroll();
	return (
		<div className="min-h-screen bg-background">
			<AppNavbar />
			<main className="mx-auto max-w-3xl px-6 pb-12 pt-28 sm:pt-32">
				<header className="mb-8">
					<p className="text-sm font-medium text-action">MCP / CLI</p>
					<h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
						{t("connect.title")}
					</h1>
					<p className="mt-4 text-base leading-7 text-muted">{t("connect.description")}</p>
				</header>
				<div className="grid gap-5 md:grid-cols-2">
					<AgentSetupCard mode="mcp" />
					<AgentSetupCard mode="cli" />
				</div>
				{(["mcp", "cli"] as const).map((mode) => (
					<section key={mode} id={mode} className="scroll-mt-28 border-b border-default py-10">
						<h2 className="text-2xl font-semibold text-foreground">{t(`connect.${mode}_setup`)}</h2>
						<ol className="my-6 list-decimal space-y-4 pl-5 text-sm leading-7 text-muted sm:text-base">
							{[1, 2, 3].map((step) => (
								<li key={step}>{t(`connect.${mode}_step${step}`)}</li>
							))}
						</ol>
						{mode === "mcp" ? (
							<>
								<code className="block overflow-x-auto rounded-xl border border-default bg-secondary p-4 text-sm text-foreground">
									https://mcp.apple-rag.com
								</code>
								<Button asChild variant="outline" className="mt-6">
									<Link to="/overview">{t("connect.dashboard")}</Link>
								</Button>
							</>
						) : (
							<>
								<details
									onToggle={(event) => setReferenceOpen(event.currentTarget.open)}
									className="mb-6 rounded-xl border border-default p-4"
								>
									<summary className="cursor-pointer text-sm font-medium text-foreground">
										{t("connect.reference")}
									</summary>
									<div className="mt-4 min-w-0">
										<Suspense fallback={plainCommands}>
											{referenceOpen ? (
												<CodeBlock language="bash" filename="agent commands" code={commands} />
											) : (
												plainCommands
											)}
										</Suspense>
									</div>
								</details>
								<div className="flex flex-wrap gap-5 text-sm text-action">
									<a
										href="https://www.npmjs.com/package/apple-rag-cli"
										target="_blank"
										rel="noreferrer"
										className="hover:underline"
									>
										{t("connect.npm")} ↗
									</a>
									<a href="/llms.txt" className="hover:underline">
										{t("connect.skill")} →
									</a>
								</div>
								<aside className="mt-8 rounded-xl border border-default bg-card p-6">
									<h3 className="font-semibold text-foreground">{t("connect.automation")}</h3>
									<p className="mt-3 text-sm leading-7 text-muted">
										{t("connect.automation_body")}
									</p>
									<Link
										to="/settings#cli-access"
										className="mt-4 inline-block text-sm text-action hover:underline"
									>
										{t("connect.settings")} →
									</Link>
								</aside>
							</>
						)}
					</section>
				))}
				<AgentFAQ />
			</main>
			<Footer />
		</div>
	);
}
