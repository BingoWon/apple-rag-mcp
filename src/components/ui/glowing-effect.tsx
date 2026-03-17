import { animate } from "motion/react";
import { memo, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const GlowingEffect = memo(() => {
	const containerRef = useRef<HTMLDivElement>(null);
	const lastPosition = useRef({ x: 0, y: 0 });
	const animationFrameRef = useRef<number>(0);

	const handleMove = useCallback((e?: MouseEvent | { x: number; y: number }) => {
		if (!containerRef.current) return;

		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current);
		}

		animationFrameRef.current = requestAnimationFrame(() => {
			const element = containerRef.current;
			if (!element) return;

			const { left, top, width, height } = element.getBoundingClientRect();
			const mouseX = e?.x ?? lastPosition.current.x;
			const mouseY = e?.y ?? lastPosition.current.y;

			if (e) {
				lastPosition.current = { x: mouseX, y: mouseY };
			}

			const center = [left + width * 0.5, top + height * 0.5];
			const distanceFromCenter = Math.hypot(mouseX - center[0], mouseY - center[1]);
			const inactiveRadius = 0.5 * Math.min(width, height) * 0.01;

			if (distanceFromCenter < inactiveRadius) {
				element.style.setProperty("--active", "0");
				return;
			}

			const isActive =
				mouseX > left - 64 &&
				mouseX < left + width + 64 &&
				mouseY > top - 64 &&
				mouseY < top + height + 64;

			element.style.setProperty("--active", isActive ? "1" : "0");

			if (!isActive) return;

			const currentAngle = parseFloat(element.style.getPropertyValue("--start")) || 0;
			const targetAngle = (180 * Math.atan2(mouseY - center[1], mouseX - center[0])) / Math.PI + 90;

			const angleDiff = ((targetAngle - currentAngle + 180) % 360) - 180;
			const newAngle = currentAngle + angleDiff;

			animate(currentAngle, newAngle, {
				duration: 2,
				ease: [0.16, 1, 0.3, 1],
				onUpdate: (value) => {
					element.style.setProperty("--start", String(value));
				},
			});
		});
	}, []);

	useEffect(() => {
		const handleScroll = () => handleMove();
		const handlePointerMove = (e: PointerEvent) => handleMove(e);

		window.addEventListener("scroll", handleScroll, { passive: true });
		document.body.addEventListener("pointermove", handlePointerMove, {
			passive: true,
		});

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
			window.removeEventListener("scroll", handleScroll);
			document.body.removeEventListener("pointermove", handlePointerMove);
		};
	}, [handleMove]);

	return (
		<div
			ref={containerRef}
			style={
				{
					"--blur": "0px",
					"--spread": 80,
					"--start": "0",
					"--active": "0",
					"--glowingeffect-border-width": "3px",
					"--repeating-conic-gradient-times": "5",
					"--gradient": `radial-gradient(circle, #10b981 10%, #10b98100 20%),
              radial-gradient(circle at 40% 40%, #f59e0b 5%, #f59e0b00 15%),
              radial-gradient(circle at 60% 60%, #ef4444 10%, #ef444400 20%),
              radial-gradient(circle at 40% 60%, #9333ea 10%, #9333ea00 20%),
              repeating-conic-gradient(
                from 236.84deg at 50% 50%,
                #10b981 0%,
                #f59e0b calc(25% / var(--repeating-conic-gradient-times)),
                #ef4444 calc(50% / var(--repeating-conic-gradient-times)),
                #9333ea calc(75% / var(--repeating-conic-gradient-times)),
                #10b981 calc(100% / var(--repeating-conic-gradient-times))
              )`,
				} as React.CSSProperties
			}
			className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-100 transition-opacity"
		>
			<div
				className={cn(
					"glow",
					"rounded-[inherit]",
					'after:content-[""] after:rounded-[inherit] after:absolute after:inset-[calc(-1*var(--glowingeffect-border-width))]',
					"after:[border:var(--glowingeffect-border-width)_solid_transparent]",
					"after:[background:var(--gradient)] after:[background-attachment:fixed]",
					"after:opacity-[var(--active)] after:transition-opacity after:duration-300",
					"after:[mask-clip:padding-box,border-box]",
					"after:[mask-composite:intersect]",
					"after:[mask-image:linear-gradient(#0000,#0000),conic-gradient(from_calc((var(--start)-var(--spread))*1deg),#00000000_0deg,#fff,#00000000_calc(var(--spread)*2deg))]",
				)}
			/>
		</div>
	);
});

GlowingEffect.displayName = "GlowingEffect";

export { GlowingEffect };
