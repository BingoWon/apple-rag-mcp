import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
	title: string;
	value: string | number;
	subtitle?: string;
	trend?: {
		value: number;
		isPositive: boolean;
	};
	icon?: React.ComponentType<{ className?: string }>;
	className?: string;
}

export function StatsCard({
	title,
	value,
	subtitle,
	trend,
	icon: Icon,
	className,
}: StatsCardProps) {
	return (
		<Card className={cn("", className)}>
			<CardContent className="p-6">
				<div className="flex items-center justify-between">
					<div className="flex-1">
						<p className="text-sm font-medium text-muted">{title}</p>
						<div className="flex items-baseline space-x-2">
							<p className="text-2xl font-bold text-light">{value}</p>
							{subtitle && <p className="text-sm text-faint">{subtitle}</p>}
						</div>
						{trend && (
							<div className="flex items-center mt-2">
								<span
									className={cn(
										"text-sm font-medium",
										trend.isPositive ? "text-success" : "text-error",
									)}
								>
									{trend.isPositive ? "+" : ""}
									{trend.value}%
								</span>
								<span className="text-sm text-faint ml-1">vs last month</span>
							</div>
						)}
					</div>
					{Icon && (
						<div className="flex-shrink-0">
							<Icon className="h-8 w-8 text-faint" />
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
