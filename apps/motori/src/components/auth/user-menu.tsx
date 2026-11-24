import { Link } from "@tanstack/react-router";
import { useDropdownMenu } from "~/components/use-dropdown-menu";
import { useTranslation } from "~/lib/i18n";

const links = [
	{ to: "/omat", key: "nav.myListings", id: "nav-dashboard" },
	{ to: "/omat/varaukset", key: "nav.bookings", id: "nav-bookings" },
	{ to: "/omat/haut", key: "nav.savedSearches", id: "nav-saved-searches" },
	{ to: "/profiili/asetukset", key: "nav.settings", id: "nav-settings" },
] as const;
const item =
	"block w-full rounded-md px-3 py-2 text-left hover:bg-muted-light focus-visible:bg-muted-light";

export function UserMenu({ onSignOut }: { onSignOut: () => void }) {
	const { t } = useTranslation("common");
	const menu = useDropdownMenu(links.length + 1);
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: close the disclosure when focus leaves both trigger and menu
		<div ref={menu.wrapperRef} className="relative" onBlur={menu.handleBlur}>
			<button
				type="button"
				data-testid="nav-user-menu"
				aria-haspopup="menu"
				aria-expanded={menu.open}
				onClick={menu.toggle}
				onKeyDown={menu.handleButtonKeyDown}
				className="min-h-11 rounded-full px-2 hover:bg-muted-light lg:px-3"
			>
				{t("nav.bottom.account")}
			</button>
			{menu.open ? (
				<div
					role="menu"
					aria-label={t("nav.userMenuAriaLabel")}
					onKeyDown={menu.handleMenuKeyDown}
					className="absolute right-0 top-full z-50 w-48 rounded-sheet border border-border bg-card p-1 shadow-md"
				>
					{links.map(({ to, key, id }, i) => (
						<Link
							key={to}
							to={to}
							role="menuitem"
							tabIndex={menu.focusIndex === i ? 0 : -1}
							ref={(el) => {
								menu.itemRefs.current[i] = el;
							}}
							className={item}
							data-testid={id}
							onClick={menu.close}
						>
							{t(key)}
						</Link>
					))}
					<button
						type="button"
						role="menuitem"
						data-testid="nav-signout"
						ref={(el) => {
							menu.itemRefs.current[links.length] = el;
						}}
						tabIndex={menu.focusIndex === links.length ? 0 : -1}
						className={item}
						onClick={() => {
							menu.close();
							onSignOut();
						}}
					>
						{t("nav.signOut")}
					</button>
				</div>
			) : null}
		</div>
	);
}
