import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextType {
	theme: Theme;
	resolvedTheme: "light" | "dark";
	setTheme: (theme: Theme) => void;
	isTransitioning: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}

interface ThemeProviderProps {
	children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
	const [theme, setTheme] = useState<Theme>("system");
	const [isTransitioning, setIsTransitioning] = useState(false);
	const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
		// Optimized initial theme detection
		if (typeof window !== "undefined") {
			return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
		}
		return "dark"; // SSR fallback
	});

	// Initialize theme from localStorage and system preference
	useEffect(() => {
		const savedTheme = localStorage.getItem("theme") as Theme;
		if (savedTheme && ["light", "dark", "system"].includes(savedTheme)) {
			setTheme(savedTheme);
		} else {
			// If no saved preference, default to system
			setTheme("system");
			localStorage.setItem("theme", "system");
		}
	}, []);

	// Optimized theme resolution
	const effectiveTheme = useMemo<"light" | "dark">(() => {
		if (theme === "system") {
			return typeof window !== "undefined" &&
				window.matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light";
		}
		return theme;
	}, [theme]);

	// Optimized DOM update with RAF and batching
	const updateDOM = useCallback((newTheme: "light" | "dark") => {
		requestAnimationFrame(() => {
			const root = document.documentElement;

			// Batch DOM operations
			root.classList.toggle("dark", newTheme === "dark");
			root.classList.toggle("light", newTheme === "light");

			// Update meta theme-color efficiently
			const metaThemeColor = document.querySelector('meta[name="theme-color"]');
			if (metaThemeColor) {
				metaThemeColor.setAttribute("content", newTheme === "dark" ? "#0a0a0a" : "#ffffff");
			}
		});
	}, []);

	// Update resolved theme and DOM when effective theme changes
	useEffect(() => {
		setResolvedTheme(effectiveTheme);
		updateDOM(effectiveTheme);
	}, [effectiveTheme, updateDOM]);

	// Listen for system theme changes (only when theme is "system")
	useEffect(() => {
		if (theme !== "system") return;

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = () => {
			const newTheme = mediaQuery.matches ? "dark" : "light";
			setResolvedTheme(newTheme);
			updateDOM(newTheme);
		};

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, [theme, updateDOM]);

	// Debounced theme setter with transition state
	const setThemeAndSave = useCallback((newTheme: Theme) => {
		setIsTransitioning(true);
		setTheme(newTheme);

		// Async localStorage to avoid blocking
		if (typeof requestIdleCallback !== "undefined") {
			requestIdleCallback(() => {
				localStorage.setItem("theme", newTheme);
			});
		} else {
			// Fallback for browsers without requestIdleCallback
			setTimeout(() => {
				localStorage.setItem("theme", newTheme);
			}, 0);
		}

		// Reset transition state
		setTimeout(() => setIsTransitioning(false), 150);
	}, []);

	return (
		<ThemeContext.Provider
			value={{
				theme,
				resolvedTheme,
				setTheme: setThemeAndSave,
				isTransitioning,
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
}
