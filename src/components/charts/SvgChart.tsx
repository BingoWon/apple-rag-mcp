import { IconDownload } from "@tabler/icons-react";
import { type PointerEvent, useLayoutEffect, useMemo, useRef, useState } from "react";

export interface ChartBucket {
	date?: string;
	axisLabel: string;
	tooltipLabel: string;
}

export interface ChartSeries {
	name: string;
	color: string;
	data: readonly (number | null)[];
}

export interface SvgChartProps {
	type: "line" | "area" | "bar";
	buckets: readonly ChartBucket[];
	series: readonly ChartSeries[];
	height: number | "100%";
	stacked?: boolean;
	fitBounds?: { min: number; max: number };
	strokeWidth?: number;
	showLegend?: boolean;
	showExport?: boolean;
	exportFilename?: string;
	ariaLabel?: string;
	formatAxisValue: (value: number) => string;
	formatTooltipValue?: (value: number | null) => string;
}

export interface AxisScale {
	min: number;
	max: number;
	ticks: number[];
}

export function computeAxisScale(
	values: readonly number[],
	options: { fitBounds?: { min: number; max: number }; tickCount?: number } = {},
): AxisScale {
	const tickCount = options.tickCount ?? 4;
	if (options.fitBounds) {
		const { min, max } = options.fitBounds;
		const safeMax = max > min ? max : min + 1;
		const step = (safeMax - min) / (tickCount - 1);
		const ticks = Array.from({ length: tickCount }, (_, index) =>
			index === tickCount - 1 ? safeMax : Math.round(min + step * index),
		);
		return { min, max: safeMax, ticks };
	}

	const finite = values.filter((value) => Number.isFinite(value) && value >= 0);
	const highest = finite.length > 0 ? Math.max(...finite) : 0;
	if (highest <= 0) {
		return { min: 0, max: 1, ticks: [0, 1] };
	}

	const allIntegers = finite.every((value) => Number.isInteger(value));
	if (allIntegers && highest <= 4) {
		const top = Math.ceil(highest);
		return {
			min: 0,
			max: top,
			ticks: Array.from({ length: top + 1 }, (_, index) => index),
		};
	}

	const rawStep = highest / tickCount;
	const magnitude = 10 ** Math.floor(Math.log10(rawStep));
	const normalized = rawStep / magnitude;
	const niceNormalized =
		normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
	const step = niceNormalized * magnitude;
	const max = Math.ceil(highest / step) * step;
	const steps = Math.max(1, Math.round(max / step));
	const ticks = Array.from({ length: steps + 1 }, (_, index) =>
		index === steps ? max : Number((index * step).toPrecision(12)),
	);
	return { min: 0, max, ticks };
}

function escapeCsvCell(value: string | number | null): string {
	const text = value === null ? "" : String(value);
	return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildChartCsv(
	buckets: readonly ChartBucket[],
	series: readonly ChartSeries[],
): string {
	const header = ["date", ...series.map((item) => item.name)].map(escapeCsvCell).join(",");
	const rows = buckets.map((bucket, index) =>
		[bucket.tooltipLabel, ...series.map((item) => item.data[index] ?? null)]
			.map(escapeCsvCell)
			.join(","),
	);
	return [header, ...rows].join("\n");
}

function topRoundedRectPath(x: number, y: number, w: number, h: number, radius: number): string {
	const r = Math.max(0, Math.min(radius, w / 2, h));
	if (r === 0) {
		return `M${x},${y} H${x + w} V${y + h} H${x} Z`;
	}
	return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

function splitLineSegments(points: readonly (readonly [number, number] | null)[]): string[] {
	const paths: string[] = [];
	let current: string[] = [];
	for (const point of points) {
		if (!point) {
			if (current.length > 0) {
				paths.push(`M${current.join(" L")}`);
				current = [];
			}
		} else {
			current.push(`${point[0].toFixed(2)},${point[1].toFixed(2)}`);
		}
	}
	if (current.length > 0) {
		paths.push(`M${current.join(" L")}`);
	}
	return paths;
}

export function SvgChart({
	type,
	buckets,
	series,
	height,
	stacked = false,
	fitBounds,
	strokeWidth = 2,
	showLegend = false,
	showExport = false,
	exportFilename = "chart-data.csv",
	ariaLabel = "Chart",
	formatAxisValue,
	formatTooltipValue,
}: SvgChartProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [size, setSize] = useState<{ width: number; height: number }>({
		width: 480,
		height: typeof height === "number" ? height : 256,
	});
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	const [hiddenNames, setHiddenNames] = useState<Set<string>>(() => new Set());

	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const measure = () => {
			const nextWidth = Math.max(160, Math.round(el.clientWidth));
			const nextHeight =
				typeof height === "number" ? height : Math.max(160, Math.round(el.clientHeight));
			setSize((prev) =>
				prev.width === nextWidth && prev.height === nextHeight
					? prev
					: { width: nextWidth, height: nextHeight },
			);
		};
		measure();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, [height]);

	const visibleSeries = useMemo(() => {
		const filtered = series.filter((item) => !hiddenNames.has(item.name));
		return filtered.length > 0 ? filtered : series;
	}, [series, hiddenNames]);

	const legendHeight = showLegend && series.length > 1 ? 26 : 0;
	const svgHeight = Math.max(96, size.height - legendHeight);
	const count = buckets.length;

	const scaleValues = useMemo(() => {
		if (stacked) {
			return buckets.map((_, index) =>
				visibleSeries.reduce((sum, item) => {
					const val = item.data[index];
					return sum + (typeof val === "number" && Number.isFinite(val) ? val : 0);
				}, 0),
			);
		}
		const values: number[] = [];
		for (const item of visibleSeries) {
			for (const val of item.data) {
				if (typeof val === "number" && Number.isFinite(val)) values.push(val);
			}
		}
		return values;
	}, [buckets, visibleSeries, stacked]);

	const axis = useMemo(
		() =>
			computeAxisScale(scaleValues, {
				fitBounds: !stacked && visibleSeries.length === 1 ? fitBounds : undefined,
				tickCount: 4,
			}),
		[scaleValues, fitBounds, stacked, visibleSeries.length],
	);

	const formattedTicks = useMemo(
		() => axis.ticks.map((value) => formatAxisValue(value)),
		[axis.ticks, formatAxisValue],
	);
	const maxTickChars = Math.max(2, ...formattedTicks.map((label) => label.length));
	const padLeft = Math.max(38, Math.min(96, Math.ceil(maxTickChars * 6.8) + 12));
	const padRight = type === "bar" ? 8 : 16;
	const padTop = showExport ? 22 : 10;
	const padBottom = 26;
	const plotWidth = Math.max(40, size.width - padLeft - padRight);
	const plotHeight = Math.max(40, svgHeight - padTop - padBottom);
	const baselineY = padTop + plotHeight;
	const span = Math.max(1e-12, axis.max - axis.min);

	const valueToY = (value: number) =>
		padTop + plotHeight - ((value - axis.min) / span) * plotHeight;

	const isBandMode = type === "bar";
	const bandWidth = count > 0 ? plotWidth / count : plotWidth;
	const indexToX = (index: number) => {
		if (count <= 0) return padLeft;
		if (isBandMode) return padLeft + (index + 0.5) * bandWidth;
		if (count === 1) return padLeft + plotWidth / 2;
		return padLeft + (index / (count - 1)) * plotWidth;
	};

	const activeIndex = hoveredIndex !== null && hoveredIndex < count ? hoveredIndex : null;

	const handlePointerMove = (event: PointerEvent<SVGRectElement>) => {
		if (count === 0) return;
		const rect = event.currentTarget.getBoundingClientRect();
		const relX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
		const nextIndex = isBandMode
			? Math.min(count - 1, Math.max(0, Math.floor((relX / rect.width) * count)))
			: count === 1
				? 0
				: Math.min(count - 1, Math.max(0, Math.round((relX / rect.width) * (count - 1))));
		setHoveredIndex(nextIndex);
	};

	const toggleSeries = (name: string) => {
		setHiddenNames((prev) => {
			const next = new Set(prev);
			if (next.has(name)) {
				next.delete(name);
			} else {
				next.add(name);
				if (next.size >= series.length) {
					next.clear();
				}
			}
			return next;
		});
	};

	const handleDownloadCsv = () => {
		const csv = buildChartCsv(buckets, visibleSeries);
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = exportFilename;
		link.click();
		URL.revokeObjectURL(url);
	};

	const formatTooltip = (value: number | null) => {
		if (formatTooltipValue) return formatTooltipValue(value);
		if (value === null || !Number.isFinite(value)) return "—";
		return formatAxisValue(value);
	};

	// Precompute cumulative stacks for area & stacked bars
	const stackedCumulatives = useMemo(() => {
		if (!stacked) return null;
		const layers: number[][] = [];
		const running = Array.from({ length: count }, () => 0);
		for (const item of visibleSeries) {
			const nextLayer = running.map((prev, index) => {
				const raw = item.data[index];
				const add = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 0;
				return prev + add;
			});
			layers.push(nextLayer);
			for (let i = 0; i < count; i++) running[i] = nextLayer[i];
		}
		return layers;
	}, [stacked, visibleSeries, count]);

	const barRatio = count <= 8 ? 0.42 : count <= 26 ? 0.62 : 0.68;
	const barRadius = count > 14 ? 2 : 4;
	const singleBarWidth = Math.max(3, Math.min(48, bandWidth * barRatio));

	const crosshairX = activeIndex !== null ? indexToX(activeIndex) : 0;
	const placeTooltipLeft = crosshairX > size.width * 0.56;

	return (
		<div
			ref={containerRef}
			className={`relative flex min-w-0 select-none flex-col ${height === "100%" ? "h-full" : ""}`}
			style={typeof height === "number" ? { height } : undefined}
		>
			{showExport && count > 0 && (
				<button
					type="button"
					onClick={handleDownloadCsv}
					aria-label="Download CSV"
					title="Download CSV"
					className="absolute top-0 right-0 z-10 inline-flex size-6 items-center justify-center rounded text-subtle transition-colors hover:bg-surface-subtle hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
				>
					<IconDownload className="size-3.5" aria-hidden="true" />
				</button>
			)}

			<svg
				role="img"
				aria-label={ariaLabel}
				width={size.width}
				height={svgHeight}
				viewBox={`0 0 ${size.width} ${svgHeight}`}
				className="block overflow-visible"
			>
				{/* Horizontal gridlines + Y-axis labels */}
				{axis.ticks.map((tick, index) => {
					const y = valueToY(tick);
					return (
						<g key={`${tick}-${index}`}>
							<line
								x1={padLeft}
								x2={padLeft + plotWidth}
								y1={y}
								y2={y}
								stroke="var(--border)"
								strokeDasharray="3 3"
								strokeWidth="1"
							/>
							<text
								x={padLeft - 8}
								y={y}
								dy="0.32em"
								textAnchor="end"
								fill="var(--subtle)"
								fontSize="11"
								className="tabular-nums"
							>
								{formattedTicks[index]}
							</text>
						</g>
					);
				})}

				{/* Hover column highlight for bar charts */}
				{isBandMode && activeIndex !== null && (
					<rect
						x={padLeft + activeIndex * bandWidth}
						y={padTop}
						width={bandWidth}
						height={plotHeight}
						fill="var(--foreground)"
						opacity="0.06"
						rx="3"
					/>
				)}

				{/* Bars */}
				{type === "bar" &&
					stacked &&
					stackedCumulatives &&
					buckets.map((_, bucketIndex) => {
						const x = indexToX(bucketIndex) - singleBarWidth / 2;
						// Find topmost non-zero series index for rounded top corners
						let topSeriesIndex = -1;
						for (let s = visibleSeries.length - 1; s >= 0; s--) {
							const v = visibleSeries[s].data[bucketIndex];
							if (typeof v === "number" && Number.isFinite(v) && v > 0) {
								topSeriesIndex = s;
								break;
							}
						}
						if (topSeriesIndex === -1) return null;
						const isHovered = activeIndex === bucketIndex;
						return (
							<g key={buckets[bucketIndex].date ?? bucketIndex}>
								{visibleSeries.map((item, seriesIndex) => {
									const raw = item.data[bucketIndex];
									if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
									const topVal = stackedCumulatives[seriesIndex][bucketIndex];
									const bottomVal =
										seriesIndex > 0 ? stackedCumulatives[seriesIndex - 1][bucketIndex] : 0;
									const yTop = valueToY(topVal);
									const yBot = valueToY(bottomVal);
									const segHeight = Math.max(1, yBot - yTop);
									const radius = seriesIndex === topSeriesIndex ? barRadius : 0;
									return (
										<path
											key={item.name}
											d={topRoundedRectPath(x, yTop, singleBarWidth, segHeight, radius)}
											fill={item.color}
											fillOpacity={isHovered ? 1 : 0.92}
										/>
									);
								})}
							</g>
						);
					})}

				{type === "bar" &&
					!stacked &&
					buckets.map((_, bucketIndex) => {
						const groupCount = Math.max(1, visibleSeries.length);
						const subWidth = Math.max(2, singleBarWidth / groupCount);
						const startX = indexToX(bucketIndex) - singleBarWidth / 2;
						const isHovered = activeIndex === bucketIndex;
						return (
							<g key={buckets[bucketIndex].date ?? bucketIndex}>
								{visibleSeries.map((item, seriesIndex) => {
									const raw = item.data[bucketIndex];
									if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
									const yTop = valueToY(raw);
									const segHeight = Math.max(1, baselineY - yTop);
									return (
										<path
											key={item.name}
											d={topRoundedRectPath(
												startX + seriesIndex * subWidth,
												yTop,
												Math.max(2, subWidth - (groupCount > 1 ? 1 : 0)),
												segHeight,
												barRadius,
											)}
											fill={item.color}
											fillOpacity={isHovered ? 1 : 0.92}
										/>
									);
								})}
							</g>
						);
					})}

				{/* Stacked Area fills + strokes */}
				{type === "area" &&
					stacked &&
					stackedCumulatives &&
					visibleSeries.map((item, seriesIndex) => {
						if (count === 0) return null;
						const topCoords = stackedCumulatives[seriesIndex].map((val, idx) => [
							indexToX(idx),
							valueToY(val),
						]);
						const botCoords =
							seriesIndex > 0
								? stackedCumulatives[seriesIndex - 1].map((val, idx) => [
										indexToX(idx),
										valueToY(val),
									])
								: buckets.map((_, idx) => [indexToX(idx), baselineY]);
						const linePath = `M${topCoords.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" L")}`;
						const areaPath = `${linePath} L${[...botCoords]
							.reverse()
							.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
							.join(" L")} Z`;
						return (
							<g key={item.name}>
								{count > 1 && <path d={areaPath} fill={item.color} fillOpacity="0.22" />}
								{count > 1 ? (
									<path
										d={linePath}
										fill="none"
										stroke={item.color}
										strokeWidth={strokeWidth}
										strokeLinejoin="round"
										strokeLinecap="round"
									/>
								) : (
									<circle cx={topCoords[0][0]} cy={topCoords[0][1]} r={4} fill={item.color} />
								)}
							</g>
						);
					})}

				{/* Line & unstacked Area paths */}
				{(type === "line" || (type === "area" && !stacked)) &&
					visibleSeries.map((item) => {
						const coords = buckets.map((_, idx) => {
							const raw = item.data[idx];
							return typeof raw === "number" && Number.isFinite(raw)
								? ([indexToX(idx), valueToY(raw)] as const)
								: null;
						});
						const segments = splitLineSegments(coords);
						const nonNull = coords.filter((pt): pt is readonly [number, number] => pt !== null);
						const fillPath =
							type === "area" && nonNull.length > 1
								? `M${nonNull.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" L")} L${nonNull[nonNull.length - 1][0].toFixed(2)},${baselineY.toFixed(2)} L${nonNull[0][0].toFixed(2)},${baselineY.toFixed(2)} Z`
								: null;
						return (
							<g key={item.name}>
								{fillPath && <path d={fillPath} fill={item.color} fillOpacity="0.2" />}
								{segments.map((d, segIdx) => (
									<path
										key={`${item.name}-${segIdx}`}
										d={d}
										fill="none"
										stroke={item.color}
										strokeWidth={strokeWidth}
										strokeLinejoin="round"
										strokeLinecap="round"
									/>
								))}
								{nonNull.length === 1 && (
									<circle cx={nonNull[0][0]} cy={nonNull[0][1]} r={4} fill={item.color} />
								)}
							</g>
						);
					})}

				{/* Vertical hover crosshair + active point markers for line/area */}
				{!isBandMode && activeIndex !== null && (
					<g pointerEvents="none">
						<line
							x1={crosshairX}
							x2={crosshairX}
							y1={padTop}
							y2={baselineY}
							stroke="var(--subtle)"
							strokeDasharray="3 3"
							strokeWidth="1"
						/>
						{visibleSeries.map((item, seriesIndex) => {
							const raw = item.data[activeIndex];
							if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
							const yVal =
								stacked && stackedCumulatives ? stackedCumulatives[seriesIndex][activeIndex] : raw;
							return (
								<circle
									key={item.name}
									cx={crosshairX}
									cy={valueToY(yVal)}
									r={4}
									fill={item.color}
									stroke="var(--card)"
									strokeWidth="2"
								/>
							);
						})}
					</g>
				)}

				{/* X-axis category labels */}
				{buckets.map((bucket, index) => {
					if (!bucket.axisLabel) return null;
					const x = indexToX(index);
					const anchor =
						!isBandMode && count > 1
							? index === 0
								? "start"
								: index === count - 1
									? "end"
									: "middle"
							: "middle";
					return (
						<text
							key={bucket.date ?? `${bucket.tooltipLabel}-${index}`}
							x={x}
							y={baselineY + 16}
							textAnchor={anchor}
							fill="var(--subtle)"
							fontSize="11"
							className="tabular-nums"
						>
							{bucket.axisLabel}
						</text>
					);
				})}

				{/* Pointer hit area */}
				<rect
					x={padLeft}
					y={padTop}
					width={plotWidth}
					height={plotHeight}
					fill="transparent"
					className="cursor-crosshair"
					onPointerMove={handlePointerMove}
					onPointerDown={handlePointerMove}
					onPointerLeave={() => setHoveredIndex(null)}
				/>
			</svg>

			{/* Bottom active X-axis badge aligned directly to crosshair for line/area */}
			{!isBandMode && activeIndex !== null && buckets[activeIndex] && (
				<div
					className="pointer-events-none absolute z-10 -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[11px] font-medium leading-tight tabular-nums text-background shadow-sm"
					style={{
						left: Math.max(padLeft + 18, Math.min(size.width - 28, crosshairX)),
						top: baselineY + 3,
					}}
				>
					{buckets[activeIndex].tooltipLabel}
				</div>
			)}

			{/* Declarative React tooltip popover — always 1 container, 1 row per visible series */}
			{activeIndex !== null && buckets[activeIndex] && (
				<div
					role="status"
					aria-live="polite"
					className="pointer-events-none absolute top-2 z-20 min-w-36 max-w-60 rounded-lg border border-border bg-card/95 text-xs shadow-complex backdrop-blur-sm"
					style={
						placeTooltipLeft
							? { right: Math.max(8, size.width - crosshairX + 12) }
							: { left: Math.max(padLeft + 4, crosshairX + 12) }
					}
				>
					<div className="border-b border-border px-2.5 py-1.5 font-medium tabular-nums text-foreground">
						{buckets[activeIndex].tooltipLabel}
					</div>
					<div className="space-y-1 px-2.5 py-1.5">
						{visibleSeries.map((item) => (
							<div key={item.name} className="flex items-center justify-between gap-3">
								<span className="flex min-w-0 items-center gap-1.5 text-muted">
									<span
										className="size-2 shrink-0 rounded-full"
										style={{ backgroundColor: item.color }}
									/>
									<span className="truncate">{item.name}</span>
								</span>
								<span className="shrink-0 font-semibold tabular-nums text-foreground">
									{formatTooltip(item.data[activeIndex] ?? null)}
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Interactive Legend */}
			{showLegend && series.length > 1 && (
				<div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
					{series.map((item) => {
						const hidden = hiddenNames.has(item.name);
						return (
							<button
								key={item.name}
								type="button"
								aria-pressed={!hidden}
								onClick={() => toggleSeries(item.name)}
								className={`inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-muted transition-opacity hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand ${
									hidden ? "opacity-40 line-through" : ""
								}`}
							>
								<span
									className="size-2 shrink-0 rounded-full"
									style={{ backgroundColor: item.color }}
								/>
								<span>{item.name}</span>
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
