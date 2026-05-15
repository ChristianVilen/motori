// src/routes/omat/index.tsx
// User dashboard — my listings + tori items, with quick actions
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { LogOut, MapPin, Pencil, Plus, Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { signOut } from "~/lib/auth-client";
import { LISTING_STATUSES, MOTORCYCLE_TYPES, REGIONS, SITE_NAME } from "~/lib/constants";
import type { Listing, ListingImage } from "~/lib/db/schema";
import { useTranslation } from "~/lib/i18n";
import { setListingStatus } from "~/lib/listings-commands";
import { getOwnerListings } from "~/lib/listings-queries";
import { protectedMutation } from "~/lib/middleware";
import { getSession } from "~/lib/session";
import { computeListingSlug, slugify } from "~/lib/slug";
import { TORI_STATUSES } from "~/lib/tori/constants";
import { setToriItemStatus } from "~/lib/tori/tori-commands";
import { useEmailVerified } from "~/lib/use-email-verified";

const getMyListings = createServerFn({ method: "GET" }).handler(async () => {
	const session = await getSession();
	if (!session) {
		throw new Error("Kirjaudu sisään");
	}

	const { db } = await import("~/lib/db/index");
	const [{ listings, images }, profile] = await Promise.all([
		getOwnerListings(session.user.id),
		db.selectFrom("profile").selectAll().where("user_id", "=", session.user.id).executeTakeFirst(),
	]);

	return { listings, images, profile, session };
});

const setListingStatusFn = createServerFn({ method: "POST" })
	.middleware(protectedMutation("set-listing-status", 20, 60))
	.inputValidator((data: { id: string; status: "active" | "paused" | "removed" }) => data)
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään");
		}

		await setListingStatus(data.id, session.user.id, data.status);
	});

const setToriStatusFn = createServerFn({ method: "POST" })
	.middleware(protectedMutation("set-tori-status", 20, 60))
	.inputValidator((data: { id: string; status: string }) => {
		const allowed = ["active", "paused", "sold"] as const;
		if (!allowed.includes(data.status as (typeof allowed)[number])) {
			throw new Error("Invalid status");
		}
		return data;
	})
	.handler(async ({ data }) => {
		await setToriItemStatus({ data });
	});

export const Route = createFileRoute("/omat/")({
	loader: async () => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/kirjaudu", search: { redirect: undefined } });
		}
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

	async function handleTogglePause() {
		const newStatus = listing.status === "active" ? "paused" : "active";
		await setListingStatusFn({ data: { id: listing.id, status: newStatus } });
		onStatusChange();
	}

	async function handleDelete() {
		if (!window.confirm(t("dashboard.row.confirmDelete"))) {
			return;
		}
		await setListingStatusFn({ data: { id: listing.id, status: "removed" } });
		onStatusChange();
	}

	const slug = computeListingSlug(listing.makeSlug, listing.modelName, listing.city);

	return (
		<div
			className="flex gap-4 rounded-l border border-border bg-card p-4"
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
						className="text-sm font-semibold text-foreground hover:text-accent"
					>
						{listing.title}
					</Link>
					<span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle}`}>
						{statusLabel}
					</span>
				</div>

				<div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
					<span>{typeLabel}</span>
					<span>·</span>
					<span>{listing.year}</span>
					<span>·</span>
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
					{verified ? (
						<Link
							to="/ilmoitukset/$listingId/muokkaa"
							params={{ listingId: listing.short_id }}
							data-testid="dashboard-listing-edit"
						>
							<Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
								<Pencil className="h-3 w-3" />
								{t("dashboard.row.edit")}
							</Button>
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

const TORI_STATUS_STYLES: Record<string, string> = {
	active: "bg-success/10 text-success",
	paused: "bg-warning/10 text-warning",
	sold: "bg-primary/10 text-primary",
	expired: "bg-muted-light text-muted",
};

interface ToriItemRowProps {
	item: Listing;
	firstImage: ListingImage | undefined;
	onStatusChange: () => void;
	verified: boolean | null;
}

function ToriItemRow({ item, firstImage, onStatusChange, verified }: ToriItemRowProps) {
	const { t } = useTranslation("profile");
	const slug = slugify(item.title);
	const statusLabel = TORI_STATUSES[item.status as keyof typeof TORI_STATUSES] ?? item.status;
	const statusStyle = TORI_STATUS_STYLES[item.status] ?? "bg-muted-light text-muted";

	async function handleTogglePause() {
		const newStatus = item.status === "active" ? "paused" : "active";
		await setToriStatusFn({ data: { id: item.id, status: newStatus } });
		onStatusChange();
	}

	async function handleMarkSold() {
		await setToriStatusFn({ data: { id: item.id, status: "sold" } });
		onStatusChange();
	}

	return (
		<div
			className="flex gap-4 rounded-l border border-border bg-card p-4"
			data-testid="dashboard-listing-row"
			data-listing-id={item.short_id}
		>
			{/* Thumbnail */}
			<Link
				to="/tori/$itemId/$slug"
				params={{ itemId: item.short_id, slug }}
				className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-muted-light"
			>
				{firstImage ? (
					<img
						src={firstImage.thumbnail_url ?? firstImage.url}
						alt=""
						className="h-full w-full object-cover"
					/>
				) : (
					<div className="flex h-full items-center justify-center text-border">
						<Plus className="h-6 w-6" />
					</div>
				)}
			</Link>

			{/* Info */}
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-start justify-between gap-2">
					<Link
						to="/tori/$itemId/$slug"
						params={{ itemId: item.short_id, slug }}
						className="text-sm font-semibold text-foreground hover:text-accent"
					>
						{item.title}
					</Link>
					<span
						className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle}`}
						data-testid="tori-item-status"
					>
						{statusLabel}
					</span>
				</div>

				<div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
					<span className="flex items-center gap-0.5">
						<MapPin className="h-3 w-3" />
						{item.city}
					</span>
					<span>·</span>
					<span className="font-medium text-accent">{item.city}</span>
				</div>

				{/* Actions */}
				<div className="mt-3 flex flex-wrap gap-2">
					{verified ? (
						<Link
							to="/tori/$itemId/muokkaa"
							params={{ itemId: item.short_id }}
							data-testid="dashboard-listing-edit"
						>
							<Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
								<Pencil className="h-3 w-3" />
								{t("dashboard.tori.edit")}
							</Button>
						</Link>
					) : null}
					{item.status !== "removed" && (
						<Button
							variant="outline"
							size="sm"
							className="h-7 px-2 text-xs"
							onClick={handleTogglePause}
							disabled={!verified}
							data-testid="tori-item-toggle-pause"
						>
							{item.status === "active" ? t("dashboard.tori.pause") : t("dashboard.tori.activate")}
						</Button>
					)}
					{item.status === "active" && (
						<Button
							variant="outline"
							size="sm"
							className="h-7 px-2 text-xs"
							onClick={handleMarkSold}
							disabled={!verified}
							data-testid="tori-item-mark-sold"
						>
							{t("dashboard.tori.markSold")}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}

type FilterTab = "all" | "pyorat" | "tori";

function ProfilePage() {
	const { listings, images, profile } = Route.useLoaderData();
	const router = useRouter();

	async function handleSignOut() {
		await signOut();
		router.invalidate();
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
				{/* Header card */}
				<div className="mb-6 overflow-hidden rounded-xl border border-border bg-card">
					{/* Name + avatar row */}
					<div className="flex items-center gap-3 px-4 pt-4 pb-3">
						<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-white">
							{(profile?.display_name ?? t("dashboard.fallbackName"))
								.split(" ")
								.slice(0, 2)
								.map((w: string) => w[0])
								.join("")
								.toUpperCase()}
						</div>
						<div>
							<h1 className="text-lg font-bold text-primary leading-tight">
								{profile?.display_name ?? t("dashboard.fallbackName")}
							</h1>
							<p className="text-xs text-muted">
								{t("dashboard.statsCombined", { active: totalActive, paused: totalPaused })}
							</p>
						</div>
					</div>

					{/* Action strip */}
					<div className="flex border-t border-border">
						<Link
							to="/profiili/asetukset"
							className="flex flex-1 flex-col items-center gap-1 py-3 text-xs text-muted transition-colors hover:bg-muted-light hover:text-foreground"
							aria-label={t("dashboard.settingsAriaLabel")}
						>
							<Settings className="h-4 w-4" />
							{t("dashboard.settingsAriaLabel")}
						</Link>
						<div className="w-px bg-border" />
						<button
							type="button"
							onClick={handleSignOut}
							className="flex flex-1 flex-col items-center gap-1 py-3 text-xs text-accent transition-colors hover:bg-accent/5"
							aria-label={t("dashboard.signOutAriaLabel")}
						>
							<LogOut className="h-4 w-4" />
							{t("dashboard.signOutAriaLabel")}
						</button>
					</div>
				</div>

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
										? "bg-accent text-white"
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
					<div className="flex flex-col items-center gap-4 rounded-l border border-dashed border-border py-16 text-center">
						<p className="text-muted">{t("dashboard.emptyState")}</p>
						{verified ? (
							<Link to="/ilmoitukset/uusi">
								<Button className="bg-accent text-white hover:bg-accent-hover">
									{t("dashboard.createFirst")}
								</Button>
							</Link>
						) : (
							<Button disabled title={tAuth("unverifiedTooltip")}>
								{t("dashboard.createFirst")}
							</Button>
						)}
					</div>
				) : (
					<div className="space-y-3">
						{filtered.map((item) =>
							isToriCategory(item.category) ? (
								<ToriItemRow
									key={item.id}
									item={item}
									firstImage={firstImageById.get(item.id)}
									onStatusChange={refresh}
									verified={verified}
								/>
							) : (
								<ListingRow
									key={item.id}
									listing={item as Listing & { makeSlug: string | null; modelName: string | null }}
									firstImage={firstImageById.get(item.id)}
									onStatusChange={refresh}
									verified={verified}
								/>
							),
						)}
					</div>
				)}
			</div>
		</div>
	);
}
