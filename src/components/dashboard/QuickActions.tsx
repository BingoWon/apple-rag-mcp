import {
	IconChartBar,
	IconCreditCard,
	IconFileText,
	IconSquareRoundedPlus,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const actions = [
	{
		title: "Create MCP Token",
		description: "Generate a new MCP token for your applications",
		href: "/mcp-tokens",
		icon: IconSquareRoundedPlus,
		color: "bg-success hover:bg-success/80",
	},
	{
		title: "View Documentation",
		description: "Learn how to integrate Apple RAG MCP service",
		href: "/docs",
		icon: IconFileText,
		color: "bg-info hover:bg-info/80",
	},
	{
		title: "Usage Analytics",
		description: "Monitor your MCP usage and performance",
		href: "/usage",
		icon: IconChartBar,
		color: "bg-brand hover:bg-brand-secondary",
	},
	{
		title: "Upgrade Plan",
		description: "Get more queries and advanced features",
		href: "/billing",
		icon: IconCreditCard,
		color: "bg-warning hover:bg-warning/80",
	},
];

export function QuickActions() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Quick Actions</CardTitle>
				<CardDescription>Common tasks to help you get started</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{actions.map((action) => (
						<Link key={action.title} to={action.href}>
							<Button
								variant="outline"
								className="h-auto p-4 flex-col items-start space-y-2 hover:bg-secondary"
							>
								<div className={`p-2 rounded-lg ${action.color}`}>
									<action.icon className="h-5 w-5 text-white" />
								</div>
								<div className="text-left">
									<div className="font-medium text-light">{action.title}</div>
									<div className="text-sm text-muted">{action.description}</div>
								</div>
							</Button>
						</Link>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
