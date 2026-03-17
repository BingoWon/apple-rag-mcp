// Performance monitoring utilities

export class PerformanceMonitor {
	private static instance: PerformanceMonitor;
	private metrics: Map<string, number> = new Map();

	static getInstance(): PerformanceMonitor {
		if (!PerformanceMonitor.instance) {
			PerformanceMonitor.instance = new PerformanceMonitor();
		}
		return PerformanceMonitor.instance;
	}

	// Mark the start of a performance measurement
	mark(name: string): void {
		if (typeof window !== "undefined" && "performance" in window) {
			performance.mark(`${name}-start`);
		}
	}

	// Mark the end and measure the duration
	measure(name: string): number {
		if (typeof window !== "undefined" && "performance" in window) {
			performance.mark(`${name}-end`);
			performance.measure(name, `${name}-start`, `${name}-end`);

			const entries = performance.getEntriesByName(name, "measure");
			if (entries.length > 0) {
				const duration = entries[entries.length - 1].duration;
				this.metrics.set(name, duration);
				return duration;
			}
		}
		return 0;
	}

	// Get all metrics
	getMetrics(): Record<string, number> {
		return Object.fromEntries(this.metrics);
	}

	// Clear all metrics
	clear(): void {
		this.metrics.clear();
		if (typeof window !== "undefined" && "performance" in window) {
			performance.clearMarks();
			performance.clearMeasures();
		}
	}

	// Log metrics to console (development only)
	logMetrics(): void {
		if (process.env.NODE_ENV === "development") {
			console.table(this.getMetrics());
		}
	}
}

// Web Vitals monitoring
export function reportWebVitals(metric: { name: string; value: number; id: string }) {
	if (process.env.NODE_ENV === "production") {
		// In production, you might want to send these to an analytics service
		console.log(metric);

		// Example: Send to Google Analytics
		// gtag('event', metric.name, {
		//   value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
		//   event_category: 'Web Vitals',
		//   event_label: metric.id,
		//   non_interaction: true,
		// })
	}
}

// Bundle analyzer helper
export function analyzeBundleSize() {
	if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
		// Log bundle information
		console.group("Bundle Analysis");
		console.log("Total JS size:", document.querySelectorAll("script[src]").length, "files");
		console.log(
			"Total CSS size:",
			document.querySelectorAll('link[rel="stylesheet"]').length,
			"files",
		);
		console.groupEnd();
	}
}

// Memory usage monitoring
export function monitorMemoryUsage() {
	if (typeof window !== "undefined" && "performance" in window && "memory" in performance) {
		const memory = (
			performance as {
				memory: {
					usedJSHeapSize: number;
					totalJSHeapSize: number;
					jsHeapSizeLimit: number;
				};
			}
		).memory;
		return {
			usedJSHeapSize: memory.usedJSHeapSize,
			totalJSHeapSize: memory.totalJSHeapSize,
			jsHeapSizeLimit: memory.jsHeapSizeLimit,
		};
	}
	return null;
}

// Network monitoring
export function monitorNetworkRequests() {
	if (typeof window !== "undefined" && "performance" in window) {
		const entries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
		const navigation = entries[0];

		if (navigation) {
			return {
				dns: navigation.domainLookupEnd - navigation.domainLookupStart,
				tcp: navigation.connectEnd - navigation.connectStart,
				request: navigation.responseStart - navigation.requestStart,
				response: navigation.responseEnd - navigation.responseStart,
				dom: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
				load: navigation.loadEventEnd - navigation.loadEventStart,
			};
		}
	}
	return null;
}

// Cache performance helper
export class CacheManager {
	private cache: Map<string, { data: unknown; timestamp: number; ttl: number }> = new Map();

	set(key: string, data: unknown, ttl: number = 5 * 60 * 1000): void {
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
			ttl,
		});
	}

	get(key: string): unknown | null {
		const item = this.cache.get(key);
		if (!item) return null;

		if (Date.now() - item.timestamp > item.ttl) {
			this.cache.delete(key);
			return null;
		}

		return item.data;
	}

	clear(): void {
		this.cache.clear();
	}

	size(): number {
		return this.cache.size;
	}
}

export const cacheManager = new CacheManager();
export const performanceMonitor = PerformanceMonitor.getInstance();
