import { Share2 } from "lucide-react";
import { useDropdownMenu } from "~/components/use-dropdown-menu";
import { useTranslation } from "~/lib/i18n";
import { buildShareLinks } from "~/lib/share";

interface ShareButtonProps {
	title: string;
	// Canonical listing path — shared instead of location.href so stale slugs,
	// query strings, and hashes never leak into shared links.
	path: string;
}

export function ShareButton({ title, path }: ShareButtonProps) {
	const { t } = useTranslation("listings");
	const menu = useDropdownMenu(2);
	// Only used once the fallback menu is open (post-hydration), so an empty
	// string on the server never reaches the DOM.
	const shareUrl = typeof window === "undefined" ? "" : window.location.origin + path;
	const links = buildShareLinks(shareUrl, title);

	async function handleClick() {
		if (navigator.share) {
			try {
				await navigator.share({ title, url: window.location.origin + path });
			} catch {
				// Best-effort: dismissing the native sheet rejects, and other share
				// failures have no recovery worth surfacing.
			}
			return;
		}
		menu.toggle();
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: dropdown wrapper needs blur handler
		<div ref={menu.wrapperRef} className="relative" onBlur={menu.handleBlur}>
			<button
				type="button"
				data-testid="share-button"
				aria-haspopup="menu"
				aria-expanded={menu.open}
				aria-label={t("detail.share")}
				onClick={handleClick}
				onKeyDown={menu.handleButtonKeyDown}
				className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted transition-transform hover:scale-110"
			>
				<Share2 className="h-4 w-4" />
			</button>

			{menu.open ? (
				<div
					role="menu"
					data-testid="share-menu"
					onKeyDown={menu.handleMenuKeyDown}
					className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-background py-1 shadow-lg"
				>
					<a
						role="menuitem"
						tabIndex={menu.focusIndex === 0 ? 0 : -1}
						ref={(el) => {
							menu.itemRefs.current[0] = el;
						}}
						href={links.whatsapp}
						target="_blank"
						rel="noopener noreferrer"
						onClick={menu.close}
						data-testid="share-menu-whatsapp"
						className="block px-4 py-2 text-sm text-foreground hover:bg-muted-light focus:bg-muted-light focus:outline-none"
					>
						WhatsApp
					</a>
					<a
						role="menuitem"
						tabIndex={menu.focusIndex === 1 ? 0 : -1}
						ref={(el) => {
							menu.itemRefs.current[1] = el;
						}}
						href={links.facebook}
						target="_blank"
						rel="noopener noreferrer"
						onClick={menu.close}
						data-testid="share-menu-facebook"
						className="block px-4 py-2 text-sm text-foreground hover:bg-muted-light focus:bg-muted-light focus:outline-none"
					>
						Facebook
					</a>
				</div>
			) : null}
		</div>
	);
}
