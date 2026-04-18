// src/routes/dashboard/index.tsx
// User dashboard — my listings, with quick actions
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { MapPin, Pencil, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { LISTING_STATUSES, MOTORCYCLE_TYPES, REGIONS } from "~/lib/constants";
import { db } from "~/lib/db/index";
import type { Listing, ListingImage } from "~/lib/db/schema";
import { getSession } from "~/lib/session";

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

export const Route = createFileRoute("/dashboard/")({
	loader: async () => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/auth/login", search: { redirect: undefined } });
		}
		return getMyListings();
	},
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
}

function ListingRow({ listing, firstImage, onStatusChange }: ListingRowProps) {
	const typeLabel =
		MOTORCYCLE_TYPES.find((t) => t.value === listing.motorcycle_type)?.label ??
		listing.motorcycle_type;
	const regionLabel = REGIONS.find((r) => r.value === listing.region)?.label ?? listing.region;
	const priceEur = Math.round(listing.price_per_day / 100);
	const statusLabel = LISTING_STATUSES[listing.status];
	const statusStyle = STATUS_STYLES[listing.status] ?? "bg-muted-light text-muted";

	async function handleTogglePause() {
		const newStatus = listing.status === "active" ? "paused" : "active";
		await setListingStatus({ data: { id: listing.id, status: newStatus } });
		onStatusChange();
	}

	async function handleDelete() {
		if (!window.confirm("Poistetaanko ilmoitus? Tätä ei voi peruuttaa.")) {
			return;
		}
		await setListingStatus({ data: { id: listing.id, status: "removed" } });
		onStatusChange();
	}

	return (
		<div className="flex gap-4 rounded-xl border border-border bg-card p-4">
			{/* Thumbnail */}
			<Link
				to="/listings/$listingId"
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
						to="/listings/$listingId"
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
					<span className="font-medium text-accent">{priceEur} €/pv</span>
				</div>

				<div className="mt-1 text-xs text-muted">{listing.view_count} näyttökertaa</div>

				{/* Actions */}
				<div className="mt-3 flex flex-wrap gap-2">
					<Link to="/listings/$listingId/edit" params={{ listingId: listing.id }}>
						<Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
							<Pencil className="h-3 w-3" />
							Muokkaa
						</Button>
					</Link>
					<Button
						variant="outline"
						size="sm"
						className="h-7 px-2 text-xs"
						onClick={handleTogglePause}
					>
						{listing.status === "active" ? "Aseta tauolle" : "Aktivoi"}
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="h-7 px-2 text-xs text-destructive hover:border-destructive hover:text-destructive"
						onClick={handleDelete}
					>
						Poista
					</Button>
				</div>
			</div>
		</div>
	);
}

function ProfilePage() {
	const { listings, images, profile } = Route.useLoaderData();
	const router = useRouter();

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
							{profile?.display_name ?? "Profiili"}
						</h1>
						<p className="mt-0.5 text-sm text-muted">
							{active.length} aktiivista · {paused.length} tauolla · {rented.length} vuokrattu
						</p>
					</div>
					<Link to="/listings/new">
						<Button className="gap-2 bg-accent text-white hover:bg-accent-hover">
							<Plus className="h-4 w-4" />
							Uusi ilmoitus
						</Button>
					</Link>
				</div>

				{/* Listings */}
				{listings.length === 0 ? (
					<div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
						<p className="text-muted">Sinulla ei ole vielä ilmoituksia.</p>
						<Link to="/listings/new">
							<Button className="bg-accent text-white hover:bg-accent-hover">
								Luo ensimmäinen ilmoitus
							</Button>
						</Link>
					</div>
				) : (
					<div className="space-y-3">
						{listings.map((listing) => (
							<ListingRow
								key={listing.id}
								listing={listing}
								firstImage={firstImageByListing.get(listing.id)}
								onStatusChange={refresh}
							/>
						))}
					</div>
				)}

				{/* Profile link */}
				<div className="mt-8 text-center">
					<Link to="/profile/settings" className="text-sm text-muted hover:text-foreground">
						Muokkaa profiilia →
					</Link>
				</div>
			</div>
		</div>
	);
}
