import { Link } from "@tanstack/react-router";
import { LogOut, Settings, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "~/lib/i18n";

interface UserMenuProps {
	onSignOut: () => void;
}

export function UserMenu({ onSignOut }: UserMenuProps) {
	const { t } = useTranslation("common");
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) {
			return;
		}
		function onClickOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", onClickOutside);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onClickOutside);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				data-testid="nav-user-menu"
				onClick={() => setOpen(!open)}
				aria-label="Käyttäjävalikko"
				aria-expanded={open}
				aria-haspopup="menu"
				className="rounded-full p-1 text-white/70 hover:text-white"
			>
				<User className="h-5 w-5" />
			</button>
			{open ? (
				<div
					role="menu"
					className="absolute right-0 top-full z-50 mt-2 w-44 rounded-lg border border-border bg-card py-1 shadow-lg"
				>
					<Link
						to="/profiili/asetukset"
						role="menuitem"
						data-testid="nav-settings"
						onClick={() => setOpen(false)}
						className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted-light"
					>
						<Settings className="h-4 w-4 text-muted" />
						{t("nav.settings")}
					</Link>
					<button
						type="button"
						role="menuitem"
						data-testid="nav-signout"
						onClick={() => {
							setOpen(false);
							onSignOut();
						}}
						className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted-light"
					>
						<LogOut className="h-4 w-4 text-muted" />
						{t("nav.signOut")}
					</button>
				</div>
			) : null}
		</div>
	);
}
