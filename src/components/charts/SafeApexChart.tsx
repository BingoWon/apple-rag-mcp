import ApexCharts, { type ApexOptions } from "apexcharts";
import { useEffect, useRef } from "react";

type ChartType = NonNullable<NonNullable<ApexOptions["chart"]>["type"]>;
type ChartSeries = NonNullable<ApexOptions["series"]>;

export interface SafeApexChartProps {
	options: ApexOptions;
	series: ChartSeries;
	type: ChartType;
	width?: string | number;
	height?: string | number;
	/**
	 * Optional fingerprint for non-JSON-serializable inputs such as formatter
	 * closures (locale, currency, theme) so updates redraw when formatting
	 * changes while skipping identical re-renders.
	 */
	signature?: string;
}

function cloneSeries(series: ChartSeries): ChartSeries {
	if (!Array.isArray(series)) return series;
	return series.map((item) => {
		if (typeof item === "object" && item !== null) {
			const record = item as { data?: unknown };
			return {
				...item,
				...(Array.isArray(record.data) ? { data: record.data.slice() } : {}),
			};
		}
		return item;
	}) as ChartSeries;
}

export function buildChartRenderSignature({
	options,
	series,
	type,
	width,
	height,
	signature,
}: SafeApexChartProps): string {
	return JSON.stringify({
		type,
		width,
		height,
		signature: signature ?? "",
		options,
		series,
	});
}

function clearPendingTooltipTimer(chart: ApexCharts) {
	const timeoutId = (
		chart as unknown as {
			w?: { globals?: { tooltip?: { seriesHoverTimeout?: ReturnType<typeof setTimeout> } } };
		}
	).w?.globals?.tooltip?.seriesHoverTimeout;
	if (timeoutId !== undefined) {
		clearTimeout(timeoutId);
	}
}

/**
 * Controlled ApexCharts wrapper that avoids `apexcharts@5.x`'s buggy `updateSeries()`
 * fast-path (`fastUpdate()`), which leaves orphan `.apexcharts-tooltip` containers,
 * appends duplicate tooltip series rows and SVG hover listeners, freezes the tooltip
 * title, and skips axis/grid redraws.
 *
 * Instead, identical re-renders (such as parent `loading` toggles) are skipped completely
 * via `renderSignature`, and real data/option changes cleanly destroy and mount a fresh
 * chart instance (instant because animations are disabled).
 */
export function SafeApexChart({
	options,
	series,
	type,
	width = "100%",
	height = "auto",
	signature,
}: SafeApexChartProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const renderSignature = buildChartRenderSignature({
		options,
		series,
		type,
		width,
		height,
		signature,
	});
	const latestConfigRef = useRef<ApexOptions>({});
	latestConfigRef.current = {
		...options,
		chart: {
			...options.chart,
			type,
			width,
			height,
		},
		series: cloneSeries(series),
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: renderSignature deterministically captures all chart config, series, and formatter inputs.
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		let disposed = false;
		const chart = new ApexCharts(el, latestConfigRef.current);
		void chart.render().catch(() => {
			if (!disposed) el.replaceChildren();
		});
		return () => {
			disposed = true;
			clearPendingTooltipTimer(chart);
			try {
				chart.destroy();
			} catch {
				// Ignore teardown errors if the chart failed or unmounted mid-render.
			}
			el.replaceChildren();
		};
	}, [renderSignature]);

	return <div ref={containerRef} />;
}

export default SafeApexChart;
