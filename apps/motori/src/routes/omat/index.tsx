// src/routes/omat/index.tsx
// User dashboard — my listings with quick actions

import { Button, buttonVariants } from "@motori/ui/button";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	Bookmark,
	CalendarDays,
	ChevronRight,
	Heart,
	LogOut,
	MapPin,
	MessageSquare,
	Pencil,
	Settings,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SellerAvatar } from "~/components/listings/seller-card";
import { isAdmin } from "~/lib/admin";
import { signOut } from "~/lib/auth-client";
import { LISTING_STATUSES, MOTORCYCLE_TYPES, REGIONS, SITE_NAME } from "~/lib/constants";
import type { Listing, ListingImage } from "~/lib/db/schema";
import { useTranslation } from "~/lib/i18n";
import { type ListingStatusChange, setListingStatus } from "~/lib/listings-commands";
import { getOwnerListings } from "~/lib/listings-owner";
import { protectedMutation } from "~/lib/middleware";
import { getProfileForEdit } from "~/lib/profile.server";
import { requireSession, requireSessionOrRedirect, requireUserId } from "~/lib/session";
import { computeListingSlug } from "~/lib/slug";
import { useEmailVerified } from "~/lib/use-email-verified";

const getMyListings = createServerFn({ method: "GET" }).handler(async () => {
	const { user } = await requireSession();
	const userId = user.id;
	const [{ listings, images }, profile] = await Promise.all([
		getOwnerListings(userId),
		getProfileForEdit(userId),
	]);

	return { listings, images, profile, canManage: isAdmin(user) };
});

const setListingStatusFn = createServerFn({ method: "POST" })
	.middleware(protectedMutation("set-listing-status", 20, 60))
	.inputValidator((data: { id: string; status: ListingStatusChange }) => {
		const allowed: ListingStatusChange[] = ["active", "paused", "removed", "sold"];
		if (!allowed.includes(data.status)) {
			throw new Error("Invalid status");
		}
		return data;
	})
	.handler(async ({ data }) => {
		await setListingStatus(data.id, await requireUserId(), data.status);
	});

export const Route = createFileRoute("/omat/")({
	loader: async ({ location }) => {
		await requireSessionOrRedirect(location.pathname);
		return getMyListings();
	},
	head: () => ({
		meta: [{ title: `Omat ilmoitukset — ${SITE_NAME}` }],
	}),
	component: ProfilePage,
});

const STATUS_STYLES: Record<string, string> = {
	active: "bg-success/10 text-success",
	paused: "bg-warning/10 text-warning",
	rented: "bg-primary/10 text-primary",
	sold: "bg-primary/10 text-primary",
	expired: "bg-muted-light text-muted",
};

interface ListingRowProps {
	listing: Listing & { makeSlug: string | null; modelName: string | null };
	firstImage: ListingImage | undefined;
	onStatusChange: () => void;
	verified: boolean | null;
}

function ListingRow({ listing, firstImage, onStatusChange, verified }: ListingRowProps) {
	const { t } = useTranslation("profile");
	const { t: tAuth } = useTranslation("auth");
	const typeLabel =
		MOTORCYCLE_TYPES.find((mt) => mt.value === listing.motorcycle_type)?.label ??
		listing.motorcycle_type;
	const regionLabel = REGIONS.find((r) => r.value === listing.region)?.label ?? listing.region;
	const statusLabel = LISTING_STATUSES[listing.status];
	const statusStyle = STATUS_STYLES[listing.status] ?? "bg-muted-light text-muted";

	async function changeStatus(status: ListingStatusChange, toastKey: string) {
		await setListingStatusFn({ data: { id: listing.id, status } });
		toast.success(t(toastKey));
		onStatusChange();
	}

	function handleTogglePause() {
		const next = listing.status === "active" ? "paused" : "active";
		return changeStatus(
			next,
			next === "paused" ? "dashboard.row.toastPaused" : "dashboard.row.toastActivated",
		);
	}

	function handleMarkSold() {
		return changeStatus("sold", "dashboard.row.toastSold");
	}

	// Setting "active" resets the expiry clock (buildStatusUpdate), so this
	// doubles as renew for a still-active listing.
	function handleRenew() {
		return changeStatus("active", "dashboard.row.toastRenewed");
	}

	async function handleDelete() {
		if (!window.confirm(t("dashboard.row.confirmDelete"))) {
			return;
		}
		await changeStatus("removed", "dashboard.row.toastDeleted");
	}

	const slug = computeListingSlug(listing.makeSlug, listing.modelName, listing.city);

	return (
		<div
			className="flex gap-3 border-b border-border py-4"
			data-testid="dashboard-listing-row"
			data-listing-id={listing.short_id}
		>
			{/* Thumbnail */}
			<Link
				to="/ilmoitukset/$listingId/$slug"
				params={{ listingId: listing.short_id, slug }}
				className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-muted-light"
			>
				{firstImage ? (
					<img src={firstImage.url} alt="" className="h-full w-full object-cover" />
				) : (
					<div className="flex h-full items-center justify-center">
						<svg
							className="h-8 w-8 text-border"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18A1.5 1.5 0 0022.5 18.75V6.75A1.5 1.5 0 0021 5.25H3A1.5 1.5 0 001.5 6.75v12A1.5 1.5 0 003 20.25z"
							/>
						</svg>
					</div>
				)}
			</Link>

			{/* Info */}
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-start justify-between gap-2">
					<Link
						to="/ilmoitukset/$listingId/$slug"
						params={{ listingId: listing.short_id, slug }}
						className="text-sm font-semibold text-foreground hover:underline"
					>
						{listing.title}
					</Link>
					<span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle}`}>
						{statusLabel}
					</span>
				</div>

				<div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
					{typeLabel != null && (
						<>
							<span>{typeLabel}</span>
							<span>·</span>
						</>
					)}
					{listing.year != null && (
						<>
							<span>{listing.year}</span>
							<span>·</span>
						</>
					)}
					<span className="flex items-center gap-0.5">
						<MapPin className="h-3 w-3" />
						{listing.city}, {regionLabel}
					</span>
				</div>

				<div className="mt-1 text-xs text-muted">
					{t("dashboard.row.viewCount", { n: listing.view_count })}
				</div>

				{/* Actions */}
				<div className="mt-3 flex flex-wrap gap-2">
					{listing.category === "sale" && (
						<Link
							to="/kauppakirja"
							search={{ ilmoitus: listing.short_id }}
							className={buttonVariants({
								variant: "outline",
								size: "sm",
								className: "px-3 text-xs",
							})}
						>
							{t("contract:link")}
						</Link>
					)}
					{verified ? (
						<Link
							to="/ilmoitukset/$listingId/muokkaa"
							params={{ listingId: listing.short_id }}
							data-testid="dashboard-listing-edit"
							className={buttonVariants({
								variant: "outline",
								size: "sm",
								className: "gap-1 px-3 text-xs",
							})}
						>
							<Pencil className="h-3 w-3" />
							{t("dashboard.row.edit")}
						</Link>
					) : (
						<Button
							variant="outline"
							size="sm"
							className="h-7 gap-1 px-2 text-xs"
							disabled
							title={tAuth("unverifiedTooltip")}
						>
							<Pencil className="h-3 w-3" />
							{t("dashboard.row.edit")}
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						className="h-7 px-2 text-xs"
						onClick={handleTogglePause}
						disabled={!verified}
						title={!verified ? tAuth("unverifiedTooltip") : undefined}
					>
						{listing.status === "active" ? t("dashboard.row.pause") : t("dashboard.row.activate")}
					</Button>
					{/* Rentals are never sold and never expire, so no mark-sold/renew for them */}
					{listing.category !== "rental" && listing.status === "active" && (
						<>
							<Button
								variant="outline"
								size="sm"
								className="h-7 px-2 text-xs"
								onClick={handleMarkSold}
								disabled={!verified}
								title={!verified ? tAuth("unverifiedTooltip") : undefined}
								data-testid="dashboard-listing-mark-sold"
							>
								{t("dashboard.row.markSold")}
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="h-7 px-2 text-xs"
								onClick={handleRenew}
								disabled={!verified}
								title={!verified ? tAuth("unverifiedTooltip") : undefined}
								data-testid="dashboard-listing-renew"
							>
								{t("dashboard.row.renew")}
							</Button>
						</>
					)}
					<Button
						variant="outline"
						size="sm"
						className="h-7 px-2 text-xs text-destructive hover:border-destructive hover:text-destructive"
						onClick={handleDelete}
						disabled={!verified}
						title={!verified ? tAuth("unverifiedTooltip") : undefined}
						data-testid="dashboard-listing-delete"
					>
						{t("dashboard.row.delete")}
					</Button>
				</div>
			</div>
		</div>
	);
}

type FilterTab = "all" | "pyorat" | "tori";

function ProfilePage() {
	const { listings, images, profile, canManage } = Route.useLoaderData();
	const router = useRouter();

	async function handleSignOut() {
		await signOut();
		router.navigate({ to: "/" });
	}
	const { t } = useTranslation("profile");
	const { t: tAuth } = useTranslation("auth");
	const verified = useEmailVerified();
	const [filter, setFilter] = useState<FilterTab>("all");

	function refresh() {
		router.invalidate();
	}

	const firstImageById = new Map<string, ListingImage>();
	for (const img of images) {
		if (!firstImageById.has(img.listing_id)) {
			firstImageById.set(img.listing_id, img);
		}
	}

	const allItems = [...listings].sort(
		(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
	);

	const isToriCategory = (cat: string) => cat === "gear" || cat === "part";

	const filtered = allItems.filter((item) => {
		if (filter === "pyorat") {
			return !isToriCategory(item.category);
		}
		if (filter === "tori") {
			return isToriCategory(item.category);
		}
		return true;
	});

	const totalActive = allItems.filter((i) => i.status === "active").length;
	const totalPaused = allItems.filter((i) => i.status === "paused").length;

	const filters: { key: FilterTab; label: string }[] = [
		{ key: "all", label: t("dashboard.filter.all") },
		{ key: "pyorat", label: t("dashboard.filter.motorcycles") },
		{ key: "tori", label: t("dashboard.filter.tori") },
	];

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-3xl px-4 py-8">
				<header className="mb-5 flex items-center gap-4">
					<SellerAvatar large name={profile?.display_name ?? t("dashboard.fallbackName")} />
					<div className="min-w-0">
						<h1 className="break-words font-heading text-2xl font-bold">
							{profile?.display_name ?? t("dashboard.fallbackName")}
						</h1>
						<p className="mt-1 text-sm text-muted">
							{t("dashboard.statsCombined", { active: totalActive, paused: totalPaused })}
						</p>
					</div>
				</header>
				<nav
					aria-label={t("common:nav.bottom.account")}
					className="mb-8 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card"
				>
					{(
						[
							{
								to: "/omat/suosikit",
								icon: Heart,
								label: t("dashboard.favoritesLabel"),
								testId: "dashboard-favorites-link",
							},
							{
								to: "/omat/haut",
								icon: Bookmark,
								label: t("dashboard.savedSearchesLabel"),
								testId: "dashboard-saved-searches-link",
							},
							{ to: "/omat/varaukset", icon: CalendarDays, label: t("common:nav.bookings") },
							{ to: "/viestit", icon: MessageSquare, label: t("common:nav.messages") },
							{
								to: "/profiili/asetukset",
								icon: Settings,
								label: t("dashboard.settingsAriaLabel"),
							},
						] as const
					).map((item) => (
						<Link
							key={item.to}
							to={item.to}
							data-testid={"testId" in item ? item.testId : undefined}
							className="flex min-h-12 items-center gap-3 px-4 text-sm font-medium hover:bg-muted-light"
						>
							<item.icon size={18} />
							{item.label}
							<ChevronRight className="ml-auto text-muted" size={16} />
						</Link>
					))}
					{canManage ? (
						<Link
							to="/admin"
							data-testid="dashboard-admin-link"
							className="flex min-h-12 items-center gap-3 px-4 text-sm font-medium hover:bg-muted-light"
						>
							<Settings size={18} />
							{t("dashboard.admin")}
							<ChevronRight size={16} className="ml-auto text-muted" />
						</Link>
					) : null}
					<button
						type="button"
						onClick={handleSignOut}
						className="flex min-h-12 w-full items-center gap-3 px-4 text-sm font-medium hover:bg-muted-light"
					>
						<LogOut size={18} />
						{t("dashboard.signOutAriaLabel")}
					</button>
				</nav>
				<h2 className="mb-3 font-heading text-xl font-bold">{t("common:nav.myListings")}</h2>
				{/* Filter chips */}
				{allItems.length > 0 && (
					<div className="mb-4 flex gap-2">
						{filters.map(({ key, label }) => (
							<button
								key={key}
								type="button"
								onClick={() => setFilter(key)}
								className={[
									"rounded-full px-3 py-1 text-sm font-medium transition-colors",
									filter === key
										? "bg-primary text-primary-foreground"
										: "bg-muted-light text-muted hover:text-foreground",
								].join(" ")}
							>
								{label}
							</button>
						))}
					</div>
				)}

				{/* Unified list */}
				{allItems.length === 0 ? (
					<div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border py-16 text-center">
						<p className="text-muted">{t("dashboard.emptyState")}</p>
						{verified ? (
							<Link to="/ilmoitukset/uusi" className={buttonVariants()}>
								{t("dashboard.createFirst")}
							</Link>
						) : (
							<Button disabled title={tAuth("unverifiedTooltip")}>
								{t("dashboard.createFirst")}
							</Button>
						)}
					</div>
				) : (
					<div className="space-y-3">
						<div className="flex justify-end">
							{verified ? (
								<Link
									to="/ilmoitukset/uusi"
									className={buttonVariants({ variant: "outline", size: "sm" })}
								>
									{t("dashboard.newListing")}
								</Link>
							) : (
								<Button variant="outline" size="sm" disabled title={tAuth("unverifiedTooltip")}>
									{t("dashboard.newListing")}
								</Button>
							)}
						</div>
						{filtered.map((item) => (
							<ListingRow
								key={item.id}
								listing={item}
								firstImage={firstImageById.get(item.id)}
								onStatusChange={refresh}
								verified={verified}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
