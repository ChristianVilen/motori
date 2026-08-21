import { type RefObject, useEffect, useRef } from "react";

const FOCUSABLE = [
	"a[href]",
	"button:not([disabled])",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	"[tabindex]",
]
	.map((s) => `${s}:not([tabindex="-1"])`)
	.join(",");

export function useFocusTrap(active: boolean, initialFocus?: RefObject<HTMLElement | null>) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// The trapped element must already be rendered on the render where `active` flips
		// true, or the trap never arms. `initialFocus` is read once, at that moment.
		if (!active || !ref.current) {
			return;
		}

		const el = ref.current;
		const prev = document.activeElement as HTMLElement | null;

		(initialFocus?.current ?? el.querySelector<HTMLElement>(FOCUSABLE))?.focus();

		function onKeyDown(e: KeyboardEvent) {
			if (e.key !== "Tab") {
				return;
			}
			const focusable = el.querySelectorAll<HTMLElement>(FOCUSABLE);
			if (focusable.length === 0) {
				return;
			}

			const firstEl = focusable[0];
			const lastEl = focusable[focusable.length - 1];

			if (e.shiftKey && document.activeElement === firstEl) {
				e.preventDefault();
				lastEl.focus();
			} else if (!e.shiftKey && document.activeElement === lastEl) {
				e.preventDefault();
				firstEl.focus();
			}
		}

		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			prev?.focus();
		};
	}, [active, initialFocus]);

	return ref;
}
