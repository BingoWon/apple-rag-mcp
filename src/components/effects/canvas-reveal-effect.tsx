import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_OPACITIES = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1];
const DEFAULT_COLORS = [[0, 255, 255]];

export const CanvasRevealEffect = ({
	animationSpeed = 0.4,
	opacities = DEFAULT_OPACITIES,
	colors = DEFAULT_COLORS,
	containerClassName,
	dotSize = 3,
	showGradient = true,
}: {
	animationSpeed?: number;
	opacities?: number[];
	colors?: number[][];
	containerClassName?: string;
	dotSize?: number;
	showGradient?: boolean;
}) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
		const step = Math.max(dotSize + 2, 5);
		const palette = colors.length > 0 ? colors : DEFAULT_COLORS;
		const opacityTable = opacities.length > 0 ? opacities : DEFAULT_OPACITIES;

		let width = 0;
		let height = 0;
		let cols = 0;
		let rows = 0;
		let offsets: Float32Array = new Float32Array(0);
		let colorIndices: Uint8Array = new Uint8Array(0);

		const resize = () => {
			const rect = canvas.getBoundingClientRect();
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			width = Math.max(1, Math.floor(rect.width));
			height = Math.max(1, Math.floor(rect.height));
			canvas.width = Math.floor(width * dpr);
			canvas.height = Math.floor(height * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

			cols = Math.ceil(width / step);
			rows = Math.ceil(height / step);
			const total = cols * rows;
			offsets = new Float32Array(total);
			colorIndices = new Uint8Array(total);
			const cx = cols / 2;
			const cy = rows / 2;
			for (let r = 0; r < rows; r++) {
				for (let c = 0; c < cols; c++) {
					const idx = r * cols + c;
					// Deterministic hash matching the original radial shimmer feel
					const hash = Math.abs(Math.sin(c * 12.9898 + r * 78.233) * 43758.5453) % 1;
					const dist = Math.hypot(c - cx, r - cy);
					offsets[idx] = dist * 0.012 + hash * 0.18;
					colorIndices[idx] = Math.floor(hash * palette.length) % palette.length;
				}
			}
		};

		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);

		let rafId = 0;
		const start = performance.now();

		const draw = (now: number) => {
			const elapsed = reducedMotion ? 10 : (now - start) / 1000;
			const phase = Math.floor(elapsed / 5);
			const reveal = elapsed * animationSpeed;
			ctx.clearRect(0, 0, width, height);

			for (let r = 0; r < rows; r++) {
				const y = r * step;
				for (let c = 0; c < cols; c++) {
					const idx = r * cols + c;
					const intro = offsets[idx];
					if (reveal < intro) continue;
					const flicker =
						Math.abs(
							Math.sin((c + phase * 3.1) * 12.9898 + (r + phase * 1.7) * 78.233) * 43758.5453,
						) % 1;
					const alpha = opacityTable[Math.floor(flicker * opacityTable.length)] ?? 0.5;
					const [red, green, blue] = palette[colorIndices[idx]] ?? palette[0];
					ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
					ctx.fillRect(c * step, y, dotSize, dotSize);
				}
			}

			if (!reducedMotion) {
				rafId = window.requestAnimationFrame(draw);
			}
		};

		rafId = window.requestAnimationFrame(draw);
		return () => {
			window.cancelAnimationFrame(rafId);
			observer.disconnect();
		};
	}, [animationSpeed, colors, dotSize, opacities]);

	return (
		<div
			className={cn("h-full relative bg-transparent w-full", containerClassName)}
			aria-hidden="true"
		>
			<canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
			{showGradient && <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-[84%]" />}
		</div>
	);
};
