import { Link, useRouterState } from "@tanstack/react-router";
import { Calendar, Home, Plus, Search, User } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { getActiveTab } from "./active-tab";

type Props = {
	session: { user: { id: string } } | null;
	verified: boolean;
	onSearchClick: () => void;
	onSignInClick: () => void;
};

export function BottomNav({ session, verified, onSearchClick, onSignInClick }: Props) {
	const { t } = useTranslation();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const active = getActiveTab(pathname);

	const labelBrowse = t("nav.bottom.browse");
	const labelSearch = t("nav.bottom.search");
	const labelAdd = t("nav.bottom.add");
	const labelBookings = t("nav.bottom.bookings");
	const labelAccount = t("nav.bottom.account");

	return (
		<nav
			aria-label={t("nav.bottom.ariaLabel")}
			className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
		>
			<TabLink to="/" label={labelBrowse} active={active === "browse"} testId="bottom-nav-browse">
				<Home size={22} />
			</TabLink>

			<TabButton label={labelSearch} onClick={onSearchClick} testId="bottom-nav-search">
				<Search size={22} />
			</TabButton>

			{!session ? (
				<TabButton label={labelAdd} onClick={onSignInClick} elevated testId="bottom-nav-add">
					<Plus size={22} />
				</TabButton>
			) : verified ? (
				<TabLink
					to="/ilmoitukset/uusi"
					label={labelAdd}
					active={false}
					elevated
					testId="bottom-nav-add"
				>
					<Plus size={22} />
				</TabLink>
			) : (
				<TabButton label={labelAdd} elevated disabled testId="bottom-nav-add">
					<Plus size={22} />
				</TabButton>
			)}

			{!session ? (
				<TabButton label={labelBookings} onClick={onSignInClick} testId="bottom-nav-bookings">
					<Calendar size={22} />
				</TabButton>
			) : (
				<TabLink
					to="/omat"
					label={labelBookings}
					active={active === "bookings"}
					testId="bottom-nav-bookings"
				>
					<Calendar size={22} />
				</TabLink>
			)}

			{!session ? (
				<TabButton label={labelAccount} onClick={onSignInClick} testId="bottom-nav-account">
					<User size={22} />
				</TabButton>
			) : (
				<TabLink
					to="/profiili/asetukset"
					label={labelAccount}
					active={active === "account"}
					testId="bottom-nav-account"
				>
					<User size={22} />
				</TabLink>
			)}
		</nav>
	);
}

function tabClass(active: boolean): string {
	return [
		"flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs",
		active ? "text-accent" : "text-muted",
	].join(" ");
}

function TabLink({
	to,
	label,
	active,
	elevated,
	testId,
	children,
}: {
	to: string;
	label: string;
	active: boolean;
	elevated?: boolean;
	testId: string;
	children: ReactNode;
}) {
	return (
		<Link
			to={to}
			aria-current={active ? "page" : undefined}
			className={tabClass(active)}
			data-testid={testId}
		>
			<IconWrap elevated={elevated}>{children}</IconWrap>
			<span>{label}</span>
		</Link>
	);
}

function TabButton({
	label,
	onClick,
	elevated,
	disabled,
	testId,
	children,
}: {
	label: string;
	onClick?: () => void;
	elevated?: boolean;
	disabled?: boolean;
	testId: string;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={tabClass(false)}
			data-testid={testId}
		>
			<IconWrap elevated={elevated} dim={disabled}>
				{children}
			</IconWrap>
			<span>{label}</span>
		</button>
	);
}

function IconWrap({
	elevated,
	dim,
	children,
}: {
	elevated?: boolean;
	dim?: boolean;
	children: ReactNode;
}) {
	if (elevated) {
		return (
			<span
				className={[
					"flex h-9 w-9 items-center justify-center rounded-full text-white",
					dim ? "bg-muted/40" : "bg-accent",
				].join(" ")}
			>
				{children}
			</span>
		);
	}
	return <span>{children}</span>;
}
