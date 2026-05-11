import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "~/lib/i18n";

const ITEMS = [
	{ to: "/pyorat/myynti", key: "nav.sale", testId: "nav-pyorat-myynti" },
	{ to: "/pyorat/vuokraus", key: "nav.rental", testId: "nav-pyorat-vuokraus" },
] as const;

export function CategoryDropdown() {
	const { t } = useTranslation("common");
	const [open, setOpen] = useState(false);
	const [focusIndex, setFocusIndex] = useState(-1);
	const ref = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

	function handleBlur(e: React.FocusEvent) {
		if (!ref.current?.contains(e.relatedTarget as Node)) {
			setOpen(false);
		}
	}

	const openMenu = useCallback(() => {
		setOpen(true);
		setFocusIndex(0);
		requestAnimationFrame(() => itemRefs.current[0]?.focus());
	}, []);

	function handleButtonKeyDown(e: React.KeyboardEvent) {
		if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			openMenu();
		}
	}

	function handleMenuKeyDown(e: React.KeyboardEvent) {
		switch (e.key) {
			case "Escape":
				e.preventDefault();
				setOpen(false);
				ref.current?.querySelector("button")?.focus();
				break;
			case "ArrowDown":
				e.preventDefault();
				setFocusIndex((i) => {
					const next = Math.min(i + 1, ITEMS.length - 1);
					itemRefs.current[next]?.focus();
					return next;
				});
				break;
			case "ArrowUp":
				e.preventDefault();
				setFocusIndex((i) => {
					const next = Math.max(i - 1, 0);
					itemRefs.current[next]?.focus();
					return next;
				});
				break;
			case "Home":
				e.preventDefault();
				setFocusIndex(0);
				itemRefs.current[0]?.focus();
				break;
			case "End":
				e.preventDefault();
				setFocusIndex(ITEMS.length - 1);
				itemRefs.current[ITEMS.length - 1]?.focus();
				break;
		}
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: dropdown wrapper needs blur handler
		<div ref={ref} className="relative" onBlur={handleBlur}>
			<button
				type="button"
				data-testid="nav-pyorat-dropdown"
				onClick={() => (open ? setOpen(false) : openMenu())}
				onKeyDown={handleButtonKeyDown}
				className="flex items-center gap-1 text-sm text-white/70 hover:text-white"
				aria-haspopup="menu"
				aria-expanded={open}
			>
				{t("nav.bikes")}
				<ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>

			{open ? (
				<div
					role="menu"
					className="absolute left-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-lg border border-white/10 bg-primary shadow-lg"
					onKeyDown={handleMenuKeyDown}
				>
					{ITEMS.map((item, i) => (
						<Link
							key={item.to}
							to={item.to}
							role="menuitem"
							tabIndex={focusIndex === i ? 0 : -1}
							ref={(el) => {
								itemRefs.current[i] = el;
							}}
							onClick={() => setOpen(false)}
							className="block px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white focus:outline-none"
							data-testid={item.testId}
						>
							{t(item.key)}
						</Link>
					))}
				</div>
			) : null}
		</div>
	);
}
