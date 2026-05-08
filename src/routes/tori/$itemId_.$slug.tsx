import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { sql } from "kysely";
import { ArrowLeft, MapPin, Tag } from "lucide-react";
import { useState } from "react";
import { ListingGallery } from "~/components/listings/listing-gallery";
import { ReportButton } from "~/components/report-button";
import { REGIONS, SITE_NAME, SITE_URL } from "~/lib/constants";
import { formatEur, useTranslation } from "~/lib/i18n";
import { getSession } from "~/lib/session";
import { slugify } from "~/lib/slug";
import { TORI_CATEGORIES, TORI_CONDITIONS } from "~/lib/tori/constants";
import { getToriItemById } from "~/lib/tori/tori-queries";

const getDb = async () => (await import("~/lib/db/index")).db;

// ─── View count (fire-and-forget, no updated_at bump) ────────────────────────
const VIEW_DEDUP_MAX = 10_000;
const viewedRecently = new Set<string>();

function recordToriView(shortId: string, viewerId: string | undefined, ip: string): void {
	const dedupKey = viewerId ? `tori:${shortId}:${viewerId}` : `tori:${shortId}:${ip}`;
	if (viewedRecently.size < VIEW_DEDUP_MAX && viewedRecently.has(dedupKey)) {
		return;
	}
	if (viewedRecently.size < VIEW_DEDUP_MAX) {
		viewedRecently.add(dedupKey);
		setTimeout(() => viewedRecently.delete(dedupKey), 60_000);
	}
	void getDb().then((db) =>
		db
			.updateTable("listing")
			.set({ view_count: sql`view_count + 1` })
			.where("short_id", "=", shortId)
			.execute()
			.catch(() => {}),
	);
}

// ─── Server function ─────────────────────────────────────────────────────────
const getToriItem = createServerFn({ method: "GET" })
	.inputValidator((shortId: string) => shortId)
	.handler(async ({ data: shortId }) => {
		const session = await getSession();
		const item = await getToriItemById({ data: shortId });
		if (!item) {
			return null;
		}

		const request = getRequest();
		const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
		recordToriView(shortId, session?.user.id, ip);

		return { item, userId: session?.user.id ?? null };
	});

export const Route = createFileRoute("/tori/$itemId_/$slug")({
	loader: async ({ params }) => {
		const result = await getToriItem({ data: params.itemId });
		if (!result) {
			throw notFound();
		}
		return result;
	},
	head: ({ loaderData }) => {
		const item = loaderData?.item;
		if (!item) {
			return {};
		}
		const title = `${item.title} — ${SITE_NAME}`;
		const desc = `${item.title} — ${formatEur(item.price_cents)}. ${item.city}.`;
		const slug = slugify(item.title);
		const url = `${SITE_URL}/tori/${item.short_id}/${slug}`;
		return {
			meta: [
				{ title },
				{ name: "description", content: desc },
				{ property: "og:title", content: title },
				{ property: "og:description", content: desc },
				{ property: "og:url", content: url },
			],
			links: [{ rel: "canonical", href: url }],
		};
	},
	component: ToriItemDetailPage,
	notFoundComponent: () => (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4">
			<p className="text-muted">Ilmoitusta ei löytynyt.</p>
			<Link to="/tori" className="text-sm text-accent underline">
				Takaisin Torille
			</Link>
		</div>
	),
});

const CONDITION_COLORS: Record<string, string> = {
	new: "bg-green-100 text-green-800",
	excellent: "bg-blue-100 text-blue-800",
	good: "bg-gray-100 text-gray-800",
	fair: "bg-amber-100 text-amber-800",
	poor: "bg-red-100 text-red-800",
};

function ToriItemDetailPage() {
	const { item, userId } = Route.useLoaderData();
	const [contactRevealed, setContactRevealed] = useState(false);
	const { t } = useTranslation("common");

	const conditionLabel =
		TORI_CONDITIONS.find((c) => c.value === item.condition)?.labelKey ?? item.condition;
	const categoryLabel =
		TORI_CATEGORIES.find((c) => c.value === item.category)?.labelKey ?? item.category;
	const conditionColor = CONDITION_COLORS[item.condition] ?? "bg-gray-100 text-gray-800";
	const regionLabel = REGIONS.find((r) => r.value === item.region)?.label ?? item.region;
	const isSold = item.status === "removed";
	const isOwner = userId === item.owner_id;

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-4xl px-4 py-4 md:py-8">
				{/* Back */}
				<Link
					to="/tori"
					className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					Takaisin
				</Link>

				<div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:gap-8">
					{/* Left column */}
					<div className="space-y-4">
						<ListingGallery
							images={item.images.map((img) => ({
								...img,
								listing_id: img.listing_id,
							}))}
							title={item.title}
						/>

						{/* Title + badges */}
						<div>
							<div className="flex items-start justify-between gap-3">
								<h1
									className="text-xl font-bold text-primary md:text-2xl"
									data-testid="tori-detail-title"
								>
									{item.title}
								</h1>
								{isSold && (
									<span className="rounded bg-black/80 px-2.5 py-1 text-xs font-semibold text-white">
										Myyty
									</span>
								)}
							</div>
							<div className="mt-1.5 flex flex-wrap gap-1.5">
								<span
									className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${conditionColor}`}
								>
									{t(conditionLabel)}
								</span>
								<span className="flex items-center gap-1 rounded-full bg-muted-light px-2.5 py-0.5 text-xs text-muted">
									<Tag className="h-3 w-3" />
									{t(categoryLabel)}
								</span>
								<span className="flex items-center gap-1 rounded-full bg-muted-light px-2.5 py-0.5 text-xs text-muted">
									<MapPin className="h-3 w-3" />
									{item.city}, {regionLabel}
								</span>
							</div>
						</div>

						{/* Description */}
						<div>
							<h2 className="mb-1.5 text-sm font-semibold text-foreground">Kuvaus</h2>
							<p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
								{item.description}
							</p>
						</div>
					</div>

					{/* Right column — price + contact */}
					<div className="space-y-4 lg:self-start">
						<div className="rounded-l border border-border bg-card p-5 shadow-sm">
							<span className="text-3xl font-bold text-accent">{formatEur(item.price_cents)}</span>

							<div className="mt-4 border-t border-border pt-4">
								{contactRevealed ? (
									<ContactInfo ownerId={item.owner_id} />
								) : (
									<button
										type="button"
										onClick={() => setContactRevealed(true)}
										className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
									>
										Näytä yhteystiedot
									</button>
								)}
							</div>

							{isOwner && (
								<div className="mt-3 border-t border-border pt-3">
									<Link
										to="/tori/$itemId/muokkaa"
										params={{ itemId: item.short_id }}
										className="block text-center text-sm text-accent hover:underline"
									>
										Muokkaa ilmoitusta
									</Link>
								</div>
							)}
						</div>

						{!!userId && !isOwner && (
							<div className="text-center">
								<ReportButton targetType="listing" targetId={item.id} />
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function ContactInfo({ ownerId }: { ownerId: string }) {
	const [profile, setProfile] = useState<{
		display_name: string;
		phone: string | null;
		email: string;
	} | null>(null);
	const [loading, setLoading] = useState(true);

	// Fetch on mount
	if (loading && !profile) {
		void getOwnerContact({ data: ownerId }).then((p) => {
			setProfile(p);
			setLoading(false);
		});
	}

	if (loading) {
		return <p className="text-sm text-muted">Ladataan...</p>;
	}

	if (!profile) {
		return <p className="text-sm text-muted">Yhteystietoja ei saatavilla.</p>;
	}

	return (
		<div className="space-y-1 text-sm">
			<p className="font-medium text-foreground">{profile.display_name}</p>
			{!!profile.phone && <p className="text-muted">{profile.phone}</p>}
			<p className="text-muted">{profile.email}</p>
		</div>
	);
}

const getOwnerContact = createServerFn({ method: "GET" })
	.inputValidator((ownerId: string) => ownerId)
	.handler(async ({ data: ownerId }) => {
		const db = await getDb();
		const [user, profile] = await Promise.all([
			db.selectFrom("user").select(["email"]).where("id", "=", ownerId).executeTakeFirst(),
			db
				.selectFrom("profile")
				.select(["display_name", "phone", "show_phone"])
				.where("user_id", "=", ownerId)
				.executeTakeFirst(),
		]);

		if (!user || !profile) {
			return null;
		}

		return {
			display_name: profile.display_name,
			phone: profile.show_phone ? profile.phone : null,
			email: user.email,
		};
	});
