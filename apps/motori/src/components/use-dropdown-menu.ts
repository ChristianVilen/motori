import { useEffect, useRef, useState } from "react";

/**
 * Shared mechanics for a button-triggered dropdown menu: open state, roving
 * focus with arrow-key navigation, blur dismissal, and outside-tap dismissal.
 * Used by CategoryDropdown (desktop nav) and MobileBrowseControls (sort menu).
 */
export function useDropdownMenu(itemCount: number) {
	const [open, setOpen] = useState(false);
	const [rawFocusIndex, setRawFocusIndex] = useState(-1);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<(HTMLElement | null)[]>([]);

	// Clamp so a shrinking item list can never strand the roving tabindex.
	const focusIndex = Math.min(rawFocusIndex, itemCount - 1);

	// iOS Safari doesn't move focus on a background tap, so onBlur alone never
	// fires there — close on any outside pointer interaction too, without
	// stealing focus back (that's the keyboard path's job).
	useEffect(() => {
		if (!open) {
			return;
		}
		function onPointerDown(e: PointerEvent) {
			if (!wrapperRef.current?.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		document.addEventListener("pointerdown", onPointerDown);
		return () => document.removeEventListener("pointerdown", onPointerDown);
	}, [open]);

	function openMenu() {
		setOpen(true);
		setRawFocusIndex(0);
		requestAnimationFrame(() => itemRefs.current[0]?.focus());
	}

	function close() {
		setOpen(false);
	}

	function closeMenu() {
		setOpen(false);
		wrapperRef.current?.querySelector("button")?.focus();
	}

	function toggle() {
		if (open) {
			setOpen(false);
		} else {
			openMenu();
		}
	}

	function handleBlur(e: React.FocusEvent) {
		if (!wrapperRef.current?.contains(e.relatedTarget as Node)) {
			setOpen(false);
		}
	}

	function handleButtonKeyDown(e: React.KeyboardEvent) {
		if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			openMenu();
		}
	}

	function moveFocus(next: number) {
		setRawFocusIndex(next);
		itemRefs.current[next]?.focus();
	}

	function handleMenuKeyDown(e: React.KeyboardEvent) {
		switch (e.key) {
			case "Escape":
				e.preventDefault();
				closeMenu();
				break;
			case "ArrowDown":
				e.preventDefault();
				moveFocus(Math.min(focusIndex + 1, itemCount - 1));
				break;
			case "ArrowUp":
				e.preventDefault();
				moveFocus(Math.max(focusIndex - 1, 0));
				break;
			case "Home":
				e.preventDefault();
				moveFocus(0);
				break;
			case "End":
				e.preventDefault();
				moveFocus(itemCount - 1);
				break;
		}
	}

	return {
		open,
		focusIndex,
		wrapperRef,
		itemRefs,
		openMenu,
		close,
		closeMenu,
		toggle,
		handleBlur,
		handleButtonKeyDown,
		handleMenuKeyDown,
	};
}
