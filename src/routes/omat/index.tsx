// src/routes/omat/index.tsx
// User dashboard — my listings, with quick actions
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { MapPin, Pencil, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { LISTING_STATUSES, MOTORCYCLE_TYPES, REGIONS } from "~/lib/constants";
import { csrfMiddleware } from "~/lib/csrf";
import { db } from "~/lib/db/index";
import type { Listing, ListingImage } from "~/lib/db/schema";
import { formatEur, useTranslation } from "~/lib/i18n";
import { requireVerifiedEmail } from "~/lib/require-verified-email";
import { getSession } from "~/lib/session";
import { useEmailVerified } from "~/lib/use-email-verified";

const getMyListings = createServerFn({ method: "GET" }).handler(async () => {
	const session = await getSession();
	if (!session) {
		throw new Error("Kirjaudu sisään");
	}

	const listings = await db
		.selectFrom("listing")
		.selectAll()
		.where("owner_id", "=", session.user.id)
		.where("status", "!=", "removed")
		.orderBy("created_at", "desc")
		.execute();

	const listingIds = listings.map((l) => l.id);
	const images =
		listingIds.length > 0
			? await db
					.selectFrom("listing_image")
					.selectAll()
					.where("listing_id", "in", listingIds)
					.orderBy("order", "asc")
					.execute()
			: [];

	const profile = await db
		.selectFrom("profile")
		.selectAll()
		.where("user_id", "=", session.user.id)
		.executeTakeFirst();

	return { listings, images, profile, session };
});

const setListingStatus = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware(), requireVerifiedEmail()])
	.inputValidator((data: { id: string; status: "active" | "paused" | "removed" }) => data)
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään");
		}

		const listing = await db
			.selectFrom("listing")
			.select(["owner_id"])
			.where("id", "=", data.id)
			.executeTakeFirst();

		if (!listing || listing.owner_id !== session.user.id) {
			throw new Error("Ei oikeuksia");
		}

		await db
			.updateTable("listing")
			.set({ status: data.status, updated_at: new Date() })
			.where("id", "=", data.id)
			.execute();
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
		meta: [{ title: "Omat ilmoitukset — Vuokramoto" }],
	}),
	component: ProfilePage,
});

const STATUS_STYLES: Record<string, string> = {
	active: "bg-success/10 text-success",
	paused: "bg-warning/10 text-warning",
	rented: "bg-primary/10 text-primary",
};

interface ListingRowProps {
	listing: Listing;
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
		await setListingStatus({ data: { id: listing.id, status: newStatus } });
		onStatusChange();
	}

	async function handleDelete() {
		if (!window.confirm(t("dashboard.row.confirmDelete"))) {
			return;
		}
		await setListingStatus({ data: { id: listing.id, status: "removed" } });
		onStatusChange();
	}

	return (
		<div className="flex gap-4 rounded-xl border border-border bg-card p-4" data-testid="dashboard-listing-row" data-listing-id={listing.id}>
			{/* Thumbnail */}
			<Link
				to="/ilmoitukset/$listingId"
				params={{ listingId: listing.id }}
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
						to="/ilmoitukset/$listingId"
						params={{ listingId: listing.id }}
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
					<span>·</span>
					<span className="font-medium text-accent">
						{formatEur(listing.price_per_day)}
						{t("dashboard.row.pricePerDay")}
					</span>
				</div>

				<div className="mt-1 text-xs text-muted">
					{t("dashboard.row.viewCount", { n: listing.view_count })}
				</div>

				{/* Actions */}
				<div className="mt-3 flex flex-wrap gap-2">
					{verified ? (
						<Link to="/ilmoitukset/$listingId/muokkaa" params={{ listingId: listing.id }} data-testid="dashboard-listing-edit">
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

function ProfilePage() {
	const { listings, images, profile } = Route.useLoaderData();
	const router = useRouter();
	const { t } = useTranslation("profile");
	const { t: tAuth } = useTranslation("auth");
	const verified = useEmailVerified();

	function refresh() {
		router.invalidate();
	}

	const active = listings.filter((l) => l.status === "active");
	const paused = listings.filter((l) => l.status === "paused");
	const rented = listings.filter((l) => l.status === "rented");

	const firstImageByListing = new Map<string, ListingImage>();
	for (const img of images) {
		if (!firstImageByListing.has(img.listing_id)) {
			firstImageByListing.set(img.listing_id, img);
		}
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-3xl px-4 py-8">
				{/* Header */}
				<div className="mb-8 flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold text-primary">
							{profile?.display_name ?? t("dashboard.fallbackName")}
						</h1>
						<p className="mt-0.5 text-sm text-muted">
							{t("dashboard.stats", {
								active: active.length,
								paused: paused.length,
								rented: rented.length,
							})}
						</p>
					</div>
					{verified ? (
						<Link to="/ilmoitukset/uusi">
							<Button
								data-testid="dashboard-new-listing"
								className="gap-2 bg-accent text-white hover:bg-accent-hover"
							>
								<Plus className="h-4 w-4" />
								{t("dashboard.newListing")}
							</Button>
						</Link>
					) : (
						<Button
							data-testid="dashboard-new-listing"
							className="gap-2"
							disabled
							title={tAuth("unverifiedTooltip")}
						>
							<Plus className="h-4 w-4" />
							{t("dashboard.newListing")}
						</Button>
					)}
				</div>

				{/* Listings */}
				{listings.length === 0 ? (
					<div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
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
						{listings.map((listing) => (
							<ListingRow
								key={listing.id}
								listing={listing}
								firstImage={firstImageByListing.get(listing.id)}
								onStatusChange={refresh}
								verified={verified}
							/>
						))}
					</div>
				)}

				{/* Profile link */}
				<div className="mt-8 text-center">
					<Link to="/profiili/asetukset" className="text-sm text-muted hover:text-foreground">
						{t("dashboard.editProfile")}
					</Link>
				</div>
			</div>
		</div>
	);
}
