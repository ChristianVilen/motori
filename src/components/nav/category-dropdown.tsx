import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { categoryBrowsePath } from "~/lib/category-routes";
import { useTranslation } from "~/lib/i18n";

export function CategoryDropdown() {
	const { t } = useTranslation("common");
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	function handleBlur(e: React.FocusEvent) {
		if (!ref.current?.contains(e.relatedTarget as Node)) {
			setOpen(false);
		}
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: dropdown wrapper needs blur handler
		<div ref={ref} className="relative" onBlur={handleBlur}>
			<button
				type="button"
				data-testid="nav-pyorat-dropdown"
				onClick={() => setOpen((v) => !v)}
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
				>
					<a
						href={categoryBrowsePath("sale")}
						role="menuitem"
						onClick={() => setOpen(false)}
						className="block px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white"
						data-testid="nav-pyorat-myynti"
					>
						{t("nav.sale")}
					</a>
					<a
						href={categoryBrowsePath("rental")}
						role="menuitem"
						onClick={() => setOpen(false)}
						className="block px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white"
						data-testid="nav-pyorat-vuokraus"
					>
						{t("nav.rental")}
					</a>
				</div>
			) : null}
		</div>
	);
}
