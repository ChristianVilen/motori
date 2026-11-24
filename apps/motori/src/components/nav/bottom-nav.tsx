import { Link, useRouterState } from "@tanstack/react-router";
import { Heart, LayoutGrid, MessageSquare, Plus, User } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "~/lib/i18n";
import { getActiveTab } from "./active-tab";
import { FavoritesBadge, UnreadBadge } from "./nav-badges";

interface Props {
	session: { user: { id: string } } | null;
	verified: boolean;
	unread: number;
	onSignInClick: () => void;
}

export function BottomNav({ session, verified, unread, onSignInClick }: Props) {
	const { t } = useTranslation("common");
	const { t: tAuth } = useTranslation("auth");
	const active = useRouterState({ select: (state) => getActiveTab(state.location.pathname) });
	return (
		<nav
			aria-label={t("nav.bottom.ariaLabel")}
			className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
		>
			<Tab
				to="/"
				active={active === "browse"}
				testId="bottom-nav-browse"
				label={t("nav.bottom.browse")}
			>
				<LayoutGrid />
			</Tab>
			<Tab
				to={session ? "/omat/suosikit" : undefined}
				onClick={onSignInClick}
				active={active === "favorites"}
				testId="bottom-nav-favorites"
				label={t("nav.favorites")}
				badge={session && <FavoritesBadge />}
			>
				<Heart />
			</Tab>
			<Tab
				to={session && verified ? "/ilmoitukset/uusi" : undefined}
				onClick={onSignInClick}
				disabled={!!session && !verified}
				title={session && !verified ? tAuth("unverifiedTooltip") : undefined}
				testId="bottom-nav-add"
				label={t("nav.bottom.add")}
			>
				<span className="grid size-11 place-items-center rounded-full bg-reflector text-foreground group-disabled:bg-muted-light group-disabled:text-muted">
					<Plus />
				</span>
			</Tab>
			<Tab
				to={session ? "/viestit" : undefined}
				onClick={onSignInClick}
				active={active === "messages"}
				testId="bottom-nav-messages"
				label={t("nav.bottom.messages")}
				badge={<UnreadBadge count={unread} />}
			>
				<MessageSquare />
			</Tab>
			<Tab
				to={session ? "/omat" : undefined}
				onClick={onSignInClick}
				active={active === "account"}
				testId="bottom-nav-account"
				label={t("nav.bottom.account")}
			>
				<User />
			</Tab>
		</nav>
	);
}

interface TabProps {
	to?: "/" | "/omat/suosikit" | "/ilmoitukset/uusi" | "/viestit" | "/omat";
	testId: string;
	label: string;
	children: ReactNode;
	badge?: ReactNode;
	active?: boolean;
	onClick?: () => void;
	disabled?: boolean;
	title?: string;
}
function Tab({ to, testId, label, children, badge, active, onClick, disabled, title }: TabProps) {
	const cls =
		"group flex min-w-0 flex-col items-center justify-center gap-[3px] text-xs leading-[1.1] font-medium text-muted aria-[current=page]:font-semibold aria-[current=page]:text-foreground";
	const content = (
		<>
			<span className="relative">
				{children}
				<span className="absolute -top-1.5 left-4">{badge}</span>
			</span>
			<span>{label}</span>
		</>
	);
	return to ? (
		<Link
			to={to}
			data-testid={testId}
			aria-current={active ? "page" : undefined}
			activeOptions={{ exact: true }}
			activeProps={{}}
			className={cls}
		>
			{content}
		</Link>
	) : (
		<button
			type="button"
			data-testid={testId}
			onClick={onClick}
			disabled={disabled}
			title={title}
			className={cls}
		>
			{content}
		</button>
	);
}
