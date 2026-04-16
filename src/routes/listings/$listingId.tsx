// src/routes/listings/$listingId.tsx
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowLeft, Calendar, MapPin, Shield, Tag } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { LICENSE_CLASSES, LISTING_STATUSES, MOTORCYCLE_TYPES, REGIONS } from "~/lib/constants";
import { db } from "~/lib/db/index";
import { getSession } from "~/lib/session";

const getListing = createServerFn({ method: "GET" })
	.inputValidator((id: string) => id)
	.handler(async ({ data: id }) => {
		const listing = await db
			.selectFrom("listing")
			.selectAll()
			.where("listing.id", "=", id)
			.where("listing.status", "!=", "removed")
			.executeTakeFirst();

		if (!listing) return null;

		// Increment view count (fire and forget — don't block render)
		db.updateTable("listing")
			.set({ view_count: listing.view_count + 1 })
			.where("id", "=", id)
			.execute()
			.catch(() => {});

		const images = await db
			.selectFrom("listing_image")
			.selectAll()
			.where("listing_id", "=", id)
			.orderBy("order", "asc")
			.execute();

		const owner = await db
			.selectFrom("profile")
			.select(["display_name", "city", "phone", "show_phone"])
			.where("user_id", "=", listing.owner_id)
			.executeTakeFirst();

		const ownerUser = await db
			.selectFrom("user")
			.select(["email"])
			.where("id", "=", listing.owner_id)
			.executeTakeFirst();

		return { listing, images, owner: owner ?? null, ownerEmail: ownerUser?.email ?? null };
	});

export const Route = createFileRoute("/listings/$listingId")({
	loader: async ({ params }) => {
		const [result, session] = await Promise.all([
			getListing({ data: params.listingId }),
			getSession(),
		]);
		if (!result) throw notFound();
		return { ...result, session };
	},
	component: ListingDetailPage,
	notFoundComponent: () => (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4">
			<p className="text-muted">Ilmoitusta ei löydy.</p>
			<Link to="/" className="text-sm text-accent underline">
				Etusivulle
			</Link>
		</div>
	),
});

function ListingDetailPage() {
	const { listing, images, owner, ownerEmail, session } = Route.useLoaderData();
	const [contactVisible, setContactVisible] = useState(false);
	const [activeImage, setActiveImage] = useState(0);

	const isOwner = session?.user.id === listing.owner_id;
	const regionLabel = REGIONS.find((r) => r.value === listing.region)?.label ?? listing.region;
	const typeLabel =
		MOTORCYCLE_TYPES.find((t) => t.value === listing.motorcycle_type)?.label ??
		listing.motorcycle_type;
	const licenseLabel =
		LICENSE_CLASSES.find((l) => l.value === listing.required_license)?.label ?? null;
	const pricePerDay = Math.round(listing.price_per_day / 100);
	const pricePerWeek = listing.price_per_week ? Math.round(listing.price_per_week / 100) : null;
	const deposit = listing.deposit_amount ? Math.round(listing.deposit_amount / 100) : null;
	const statusLabel = LISTING_STATUSES[listing.status as keyof typeof LISTING_STATUSES];

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-4xl px-4 py-8">
				{/* Back */}
				<Link
					to="/"
					className="mb-6 flex items-center gap-1 text-sm text-muted hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					Takaisin
				</Link>

				<div className="grid gap-8 lg:grid-cols-[1fr_320px]">
					{/* Left column */}
					<div className="space-y-6">
						{/* Gallery */}
						{images.length > 0 ? (
							<div className="space-y-2">
								<div className="aspect-[16/10] overflow-hidden rounded-xl bg-muted-light">
									<img
										src={images[activeImage]?.url}
										alt={listing.title}
										className="h-full w-full object-cover"
									/>
								</div>
								{images.length > 1 && (
									<div className="flex gap-2 overflow-x-auto pb-1">
										{images.map((img, i) => (
											<button
												key={img.id}
												type="button"
												onClick={() => setActiveImage(i)}
												className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
													i === activeImage ? "border-accent" : "border-transparent"
												}`}
											>
												<img
													src={img.url}
													alt=""
													className="h-full w-full object-cover"
												/>
											</button>
										))}
									</div>
								)}
							</div>
						) : (
							<div className="flex aspect-[16/10] items-center justify-center rounded-xl bg-muted-light">
								<svg
									className="h-16 w-16 text-border"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1}
										d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18A1.5 1.5 0 0022.5 18.75V6.75A1.5 1.5 0 0021 5.25H3A1.5 1.5 0 001.5 6.75v12A1.5 1.5 0 003 20.25z"
									/>
								</svg>
							</div>
						)}

						{/* Title + badges */}
						<div>
							<div className="flex items-start justify-between gap-3">
								<h1 className="text-2xl font-bold text-primary">{listing.title}</h1>
								{listing.status !== "active" && (
									<span className="shrink-0 rounded bg-warning/20 px-2 py-1 text-xs font-medium text-warning">
										{statusLabel}
									</span>
								)}
							</div>
							<div className="mt-2 flex flex-wrap gap-2">
								<span className="flex items-center gap-1 rounded-full bg-muted-light px-3 py-1 text-xs text-muted">
									<Tag className="h-3 w-3" />
									{typeLabel}
								</span>
								<span className="flex items-center gap-1 rounded-full bg-muted-light px-3 py-1 text-xs text-muted">
									<MapPin className="h-3 w-3" />
									{listing.city}, {regionLabel}
								</span>
								{licenseLabel && (
									<span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
										Kortti {licenseLabel}
									</span>
								)}
								{listing.includes_helmet && (
									<span className="rounded-full bg-success/10 px-3 py-1 text-xs text-success">
										Kypärä mukana
									</span>
								)}
								{listing.includes_insurance && (
									<span className="flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs text-success">
										<Shield className="h-3 w-3" />
										Vakuutus mukana
									</span>
								)}
							</div>
						</div>

						{/* Specs */}
						<div className="rounded-xl border border-border bg-card p-5">
							<h2 className="mb-3 text-sm font-semibold text-foreground">Tiedot</h2>
							<dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
								<div>
									<dt className="text-muted">Merkki</dt>
									<dd className="font-medium text-foreground">{listing.brand}</dd>
								</div>
								<div>
									<dt className="text-muted">Malli</dt>
									<dd className="font-medium text-foreground">{listing.model}</dd>
								</div>
								<div>
									<dt className="text-muted">Vuosimalli</dt>
									<dd className="font-medium text-foreground">{listing.year}</dd>
								</div>
								{listing.engine_cc && (
									<div>
										<dt className="text-muted">Moottori</dt>
										<dd className="font-medium text-foreground">{listing.engine_cc} cc</dd>
									</div>
								)}
								{listing.mileage_limit && (
									<div>
										<dt className="text-muted">Km-raja</dt>
										<dd className="font-medium text-foreground">{listing.mileage_limit} km/pv</dd>
									</div>
								)}
								{listing.available_from && (
									<div>
										<dt className="flex items-center gap-1 text-muted">
											<Calendar className="h-3 w-3" />
											Saatavilla
										</dt>
										<dd className="font-medium text-foreground">
											{listing.available_from}
											{listing.available_to ? ` – ${listing.available_to}` : ""}
										</dd>
									</div>
								)}
							</dl>
						</div>

						{/* Description */}
						<div>
							<h2 className="mb-2 text-sm font-semibold text-foreground">Kuvaus</h2>
							<p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
								{listing.description}
							</p>
						</div>
					</div>

					{/* Right column — sticky sidebar */}
					<div className="space-y-4 lg:sticky lg:top-8 lg:self-start">
						{/* Pricing card */}
						<div className="rounded-xl border border-border bg-card p-5 shadow-sm">
							<div className="mb-4">
								<span className="text-3xl font-bold text-accent">{pricePerDay} €</span>
								<span className="ml-1 text-sm text-muted">/päivä</span>
								{pricePerWeek && (
									<div className="mt-1 text-sm text-muted">
										{pricePerWeek} € / viikko
									</div>
								)}
								{deposit && (
									<div className="mt-1 text-sm text-muted">Vakuus: {deposit} €</div>
								)}
								{listing.price_description && (
									<div className="mt-1 text-xs text-muted">{listing.price_description}</div>
								)}
							</div>

							{/* Contact reveal */}
							{!contactVisible ? (
								<Button
									onClick={() => setContactVisible(true)}
									className="w-full bg-accent text-white hover:bg-accent-hover"
								>
									Näytä yhteystiedot
								</Button>
							) : (
								<div className="space-y-2 rounded-lg bg-muted-light p-3 text-sm">
									<p className="font-medium text-foreground">
										{owner?.display_name ?? "Ilmoittaja"}
									</p>
									{owner?.phone && (
										<a
											href={`tel:${owner.phone}`}
											className="block text-accent hover:underline"
										>
											{owner.phone}
										</a>
									)}
									{ownerEmail && (
										<a
											href={`mailto:${ownerEmail}`}
											className="block text-accent hover:underline"
										>
											{ownerEmail}
										</a>
									)}
									{owner?.city && (
										<p className="text-muted">{owner.city}</p>
									)}
								</div>
							)}

							{/* Owner actions */}
							{isOwner && (
								<div className="mt-3 flex gap-2">
									<Link
										to="/listings/$listingId/edit"
										params={{ listingId: listing.id }}
										className="flex-1"
									>
										<Button variant="outline" className="w-full" size="sm">
											Muokkaa
										</Button>
									</Link>
									<Link to="/profile" className="flex-1">
										<Button variant="outline" className="w-full" size="sm">
											Omat ilmoitukset
										</Button>
									</Link>
								</div>
							)}
						</div>

						{/* Insurance info */}
						{listing.includes_insurance && listing.insurance_info && (
							<div className="rounded-xl border border-border bg-card p-4 text-sm">
								<p className="mb-1 flex items-center gap-1 font-medium text-foreground">
									<Shield className="h-4 w-4 text-success" />
									Vakuutustiedot
								</p>
								<p className="text-muted">{listing.insurance_info}</p>
							</div>
						)}

						{/* Listing meta */}
						<p className="text-center text-xs text-muted">
							{listing.view_count} näyttökertaa
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
