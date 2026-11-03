import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function usePageScroll() {
	const { pathname, hash } = useLocation();
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset scroll on a path change even when the hash stays empty.
	useEffect(() => {
		if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
		else window.scrollTo({ top: 0, behavior: "instant" });
	}, [pathname, hash]);
}
