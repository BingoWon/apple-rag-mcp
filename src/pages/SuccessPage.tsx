import { IconCircleCheck } from "@tabler/icons-react";
import { Suspense } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

function SuccessContent() {
	return (
		<div className="min-h-screen bg-background flex items-center justify-center px-4">
			<div className="max-w-md w-full text-center">
				<div className="mb-8">
					<IconCircleCheck className="w-16 h-16 text-success mx-auto mb-4" />
					<h1 className="text-3xl font-bold text-foreground mb-2">Payment Successful!</h1>
					<p className="text-muted-foreground">
						Welcome to Apple RAG MCP Pro! Your subscription is now active.
					</p>
				</div>

				<div className="bg-card border border-border rounded-lg p-6 mb-8">
					<h2 className="text-lg font-semibold text-foreground mb-3">What's Next?</h2>
					<ul className="text-left space-y-2 text-muted-foreground">
						<li className="flex items-center">
							<IconCircleCheck className="w-4 h-4 text-success mr-2 flex-shrink-0" />
							Access to 50,000 queries per week
						</li>
						<li className="flex items-center">
							<IconCircleCheck className="w-4 h-4 text-success mr-2 flex-shrink-0" />
							50 requests per minute
						</li>
						<li className="flex items-center">
							<IconCircleCheck className="w-4 h-4 text-success mr-2 flex-shrink-0" />
							Advanced RAG search features
						</li>
						<li className="flex items-center">
							<IconCircleCheck className="w-4 h-4 text-success mr-2 flex-shrink-0" />
							Usage analytics dashboard
						</li>
					</ul>
				</div>

				<div className="space-y-3">
					<Link to="/overview/" className="block">
						<Button className="w-full">Go to Dashboard</Button>
					</Link>
					<Link to="/" className="block">
						<Button variant="outline" className="w-full">
							Back to Home
						</Button>
					</Link>
				</div>
			</div>
		</div>
	);
}

export default function SuccessPage() {
	return (
		<Suspense fallback={<div></div>}>
			<SuccessContent />
		</Suspense>
	);
}
