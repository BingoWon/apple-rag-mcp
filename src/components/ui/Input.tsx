// Input component extends from shadcnui - https://ui.shadcn.com/docs/components/input
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	error?: string;
	label?: string;
	helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, type, error, label, helperText, ...props }, ref) => {
		const radius = 100; // change this to increase the rdaius of the hover effect
		const [visible, setVisible] = React.useState(false);

		const mouseX = useMotionValue(0);
		const mouseY = useMotionValue(0);

		function handleMouseMove({
			currentTarget,
			clientX,
			clientY,
		}: React.MouseEvent<HTMLInputElement>) {
			const { left, top } = currentTarget.getBoundingClientRect();

			mouseX.set(clientX - left);
			mouseY.set(clientY - top);
		}
		return (
			<motion.div
				style={{
					background: useMotionTemplate`
        radial-gradient(
          ${visible ? `${radius}px` : "0px"} circle at ${mouseX}px ${mouseY}px,
          hsl(var(--primary)),
          transparent 80%
        )
      `,
				}}
				onMouseMove={handleMouseMove}
				onMouseEnter={() => setVisible(true)}
				onMouseLeave={() => setVisible(false)}
				className="group/input rounded-lg p-[2px] transition-all"
			>
				<input
					type={type}
					className={cn(
						"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-all group-hover/input:shadow-none file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-[2px] focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
						className,
					)}
					ref={ref}
					{...props}
				/>
			</motion.div>
		);
	},
);
Input.displayName = "Input";

export { Input };
