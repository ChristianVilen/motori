import { Logo } from "@motori/ui/logo";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "~/lib/i18n";
import { UserMenu } from "../auth/user-menu";
import { LanguageSelector } from "../language-selector";
import { FavoritesBadge, UnreadBadge } from "./nav-badges";
import { MobileSearchTrigger, SiteSearch } from "./site-search";

const navLink =
	"inline-flex min-h-11 items-center gap-2 rounded-full px-2 lg:px-3 hover:bg-muted-light";
const sellButton =
	"inline-flex min-h-11 items-center gap-1.5 rounded-full bg-reflector pl-4 pr-5 font-semibold text-foreground hover:bg-reflector-press";

function AccountLink({
	loggedIn,
	to,
	testId,
	onLogin,
	children,
}: {
	loggedIn: boolean;
	to: "/viestit" | "/omat/suosikit";
	testId: string;
	onLogin: () => void;
	children: ReactNode;
}) {
	return loggedIn ? (
		<Link to={to} data-testid={testId} className={navLink}>
			{children}
		</Link>
	) : (
		<button type="button" data-testid={testId} className={navLink} onClick={onLogin}>
			{children}
		</button>
	);
}

export function SiteHeader({
	loggedIn,
	verified,
	unread,
	onLogin,
	onSearch,
	onSignOut,
}: {
	loggedIn: boolean;
	verified: boolean;
	unread: number;
	onLogin: () => void;
	onSearch: () => void;
	onSignOut: () => void;
}) {
	const { t } = useTranslation("common");
	const { t: tAuth } = useTranslation("auth");
	const sell = (
		<>
			<Plus size={18} aria-hidden="true" />
			{t("nav.bottom.add")}
		</>
	);
	return (
		<header className="sticky top-[calc(-1*var(--header-height))] z-20 border-b border-border bg-background md:top-0 print:hidden">
			<div className="mx-auto max-w-[1304px] px-4 lg:px-8">
				<div className="flex h-(--header-height) items-center gap-2 text-[15px] md:gap-3 lg:gap-5">
					<Link to="/" className="shrink-0 rounded-md pr-2">
						<Logo className="md:text-[30px]" />
					</Link>
					<SiteSearch />
					<nav
						aria-label={t("nav.mainMenu")}
						className="ml-auto hidden items-center gap-1 whitespace-nowrap font-medium md:flex"
					>
						<AccountLink
							loggedIn={loggedIn}
							to="/omat/suosikit"
							testId="nav-favorites"
							onLogin={onLogin}
						>
							{t("nav.favorites")}
							{loggedIn ? <FavoritesBadge /> : null}
						</AccountLink>
						<AccountLink loggedIn={loggedIn} to="/viestit" testId="nav-messages" onLogin={onLogin}>
							{t("nav.messages")}
							<UnreadBadge count={unread} />
						</AccountLink>
						{loggedIn ? (
							<UserMenu onSignOut={onSignOut} />
						) : (
							<button type="button" data-testid="nav-login" onClick={onLogin} className={navLink}>
								{t("nav.bottom.account")}
							</button>
						)}
					</nav>
					<div className="ml-auto flex shrink-0 items-center md:ml-0">
						{!loggedIn && (
							<button
								type="button"
								data-testid="nav-login-mobile"
								className="min-h-11 px-2 md:hidden"
								onClick={onLogin}
							>
								{t("nav.signIn")}
							</button>
						)}
						<LanguageSelector />
					</div>
					<div className="hidden shrink-0 md:block">
						{loggedIn && verified ? (
							<Link to="/ilmoitukset/uusi" data-testid="nav-add-listing" className={sellButton}>
								{sell}
							</Link>
						) : (
							<button
								type="button"
								data-testid="nav-add-listing"
								disabled={loggedIn}
								title={loggedIn ? tAuth("unverifiedTooltip") : undefined}
								onClick={onLogin}
								className={
									sellButton +
									" disabled:cursor-not-allowed disabled:bg-muted-light disabled:text-muted"
								}
							>
								{sell}
							</button>
						)}
					</div>
				</div>
				<MobileSearchTrigger onOpen={onSearch} />
			</div>
		</header>
	);
}
