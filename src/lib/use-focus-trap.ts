import { useEffect, useRef } from "react";

const FOCUSABLE =
	'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useFocusTrap(active: boolean) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!active || !ref.current) {
			return;
		}

		const el = ref.current;
		const prev = document.activeElement as HTMLElement | null;

		const first = el.querySelector<HTMLElement>(FOCUSABLE);
		first?.focus();

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
	}, [active]);

	return ref;
}
