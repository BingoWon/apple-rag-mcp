import { type RefObject, useCallback, useEffect } from "react";

/**
 * Configuration options for useOutsideClick hook
 */
interface UseOutsideClickOptions {
	/** Whether to listen for mouse events (default: true) */
	mouseEvents?: boolean;
	/** Whether to listen for touch events (default: true) */
	touchEvents?: boolean;
	/** Whether to listen for escape key (default: true) */
	escapeKey?: boolean;
	/** Whether the hook is enabled (default: true) */
	enabled?: boolean;
}

/**
 * Event handler function type
 */
type EventHandler = (event: Event) => void;

/**
 * Custom hook to detect clicks outside of a specified element
 *
 * @param ref - React ref object pointing to the target element
 * @param callback - Function to call when outside click is detected
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * const modalRef = useRef<HTMLDivElement>(null);
 * useOutsideClick(modalRef, () => setIsOpen(false));
 * ```
 */
export const useOutsideClick = (
	ref: RefObject<HTMLElement | null>,
	callback: () => void,
	options: UseOutsideClickOptions = {},
): void => {
	const { mouseEvents = true, touchEvents = true, escapeKey = true, enabled = true } = options;

	// Memoize the event handler to prevent unnecessary re-renders
	const handleEvent = useCallback<EventHandler>(
		(event) => {
			// Don't trigger if hook is disabled
			if (!enabled) return;

			// Handle keyboard events (ESC key)
			if (event.type === "keydown") {
				const keyboardEvent = event as KeyboardEvent;
				if (keyboardEvent.key === "Escape") {
					callback();
					return;
				}
			}

			// Handle mouse and touch events
			if (event.type === "mousedown" || event.type === "touchstart") {
				const target = event.target as Node;

				// Don't trigger if ref is not set or target is not a Node
				if (!ref.current || !target) return;

				// Don't trigger if click is inside the target element
				if (ref.current.contains(target)) return;

				// Trigger callback for outside clicks
				callback();
			}
		},
		[ref, callback, enabled],
	);

	useEffect(() => {
		// Don't add listeners if hook is disabled
		if (!enabled) return;

		// Register event listeners directly
		if (mouseEvents) {
			document.addEventListener("mousedown", handleEvent, { passive: true });
		}

		if (touchEvents) {
			document.addEventListener("touchstart", handleEvent, { passive: true });
		}

		if (escapeKey) {
			document.addEventListener("keydown", handleEvent);
		}

		// Cleanup function to remove all event listeners
		return () => {
			if (mouseEvents) {
				document.removeEventListener("mousedown", handleEvent);
			}
			if (touchEvents) {
				document.removeEventListener("touchstart", handleEvent);
			}
			if (escapeKey) {
				document.removeEventListener("keydown", handleEvent);
			}
		};
	}, [handleEvent, mouseEvents, touchEvents, escapeKey, enabled]);
};

export default useOutsideClick;
