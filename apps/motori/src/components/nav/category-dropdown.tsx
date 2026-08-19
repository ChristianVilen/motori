import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "~/lib/i18n";
import { useDropdownMenu } from "../use-dropdown-menu";

const ITEMS = [
	{ to: "/pyorat/myynti", key: "nav.sale", testId: "nav-pyorat-myynti" },
	{ to: "/pyorat/vuokraus", key: "nav.rental", testId: "nav-pyorat-vuokraus" },
] as const;

export function CategoryDropdown() {
	const { t } = useTranslation("common");
	const menu = useDropdownMenu(ITEMS.length);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: dropdown wrapper needs blur handler
		<div ref={menu.wrapperRef} className="relative" onBlur={menu.handleBlur}>
			<button
				type="button"
				data-testid="nav-pyorat-dropdown"
				onClick={menu.toggle}
				onKeyDown={menu.handleButtonKeyDown}
				className="flex items-center gap-1 text-sm text-white/70 hover:text-white"
				aria-haspopup="menu"
				aria-expanded={menu.open}
			>
				{t("nav.bikes")}
				<ChevronDown
					className={`h-3.5 w-3.5 transition-transform ${menu.open ? "rotate-180" : ""}`}
				/>
			</button>

			{menu.open ? (
				<div
					role="menu"
					className="absolute left-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-lg border border-white/10 bg-primary shadow-lg"
					onKeyDown={menu.handleMenuKeyDown}
				>
					{ITEMS.map((item, i) => (
						<Link
							key={item.to}
							to={item.to}
							role="menuitem"
							tabIndex={menu.focusIndex === i ? 0 : -1}
							ref={(el) => {
								menu.itemRefs.current[i] = el;
							}}
							onClick={menu.close}
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
