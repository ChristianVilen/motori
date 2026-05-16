import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Key, Shield, ShoppingCart, Wrench } from "lucide-react";
import { useState } from "react";
import { ListingCard } from "~/components/listings/listing-card";
import { CATEGORY_BROWSE_PATH } from "~/lib/category-routes";
import type { ListingCategory } from "~/lib/db/schema";
import { useTranslation } from "~/lib/i18n";
import { getLatestListings } from "~/lib/listings-search.server";
import { getHomepageStats } from "~/lib/listings-stats.server";
import { getSession } from "~/lib/session";

export const Route = createFileRoute("/")({
	loader: async () => {
		const [saleListings, rentalListings, gearListings, partListings, stats, session] =
			await Promise.all([
				getLatestListings({ data: "sale" }),
				getLatestListings({ data: "rental" }),
				getLatestListings({ data: "gear" }),
				getLatestListings({ data: "part" }),
				getHomepageStats(),
				getSession(),
			]);
		const emailVerified = session?.user.emailVerified ?? true;
		return { saleListings, rentalListings, gearListings, partListings, stats, emailVerified };
	},
	component: HomePage,
});

type ActiveTab = "sale" | "rental" | "gear" | "part";

function HomePage() {
	const {
		saleListings,
		rentalListings,
		gearListings,
		partListings,
		stats,
		emailVerified: verified,
	} = Route.useLoaderData();
	const navigate = useNavigate();
	const { t } = useTranslation("home");
	const { t: tAuth } = useTranslation("auth");

	const [activeTab, setActiveTab] = useState<ActiveTab>("sale");

	const tabData: Record<ActiveTab, ReturnType<typeof saleListings.slice>> = {
		sale: saleListings,
		rental: rentalListings,
		gear: gearListings,
		part: partListings,
	};

	const tabs: {
		key: ActiveTab;
		labelKey:
			| "latestListings.tabs.sale"
			| "latestListings.tabs.rental"
			| "latestListings.tabs.gear"
			| "latestListings.tabs.parts";
	}[] = [
		{ key: "sale", labelKey: "latestListings.tabs.sale" },
		{ key: "rental", labelKey: "latestListings.tabs.rental" },
		{ key: "gear", labelKey: "latestListings.tabs.gear" },
		{ key: "part", labelKey: "latestListings.tabs.parts" },
	];

	const categories: {
		key: ListingCategory;
		icon: React.ReactNode;
		labelKey: "categories.sale" | "categories.rental" | "categories.gear" | "categories.parts";
	}[] = [
		{
			key: "sale",
			icon: <ShoppingCart className="h-6 w-6" />,
			labelKey: "categories.sale",
		},
		{
			key: "rental",
			icon: <Key className="h-6 w-6" />,
			labelKey: "categories.rental",
		},
		{
			key: "gear",
			icon: <Shield className="h-6 w-6" />,
			labelKey: "categories.gear",
		},
		{
			key: "part",
			icon: <Wrench className="h-6 w-6" />,
			labelKey: "categories.parts",
		},
	];

	function handleSearch(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const q = (formData.get("q") as string)?.trim() || undefined;
		navigate({ to: "/pyorat/myynti", search: q ? { q } : {} });
	}

	const activeListings = tabData[activeTab];

	return (
		<div className="min-h-screen">
			{/* Hero */}
			<section className="relative overflow-hidden bg-primary">
				{/* Hero image — full bleed on mobile, right half on lg */}
				<img
					src="/images/kawasaki-ninja-rider-sunset-1200w.webp"
					srcSet="/images/kawasaki-ninja-rider-sunset-400w.webp 400w, /images/kawasaki-ninja-rider-sunset-800w.webp 800w, /images/kawasaki-ninja-rider-sunset-1200w.webp 1200w, /images/kawasaki-ninja-rider-sunset-1920w.webp 1920w"
					sizes="(min-width: 1024px) 50vw, 100vw"
					alt={t("hero.imgAlt")}
					className="absolute inset-0 h-full w-full object-cover lg:left-1/2 lg:w-1/2"
				/>
				{/* Mobile darken */}
				<div className="absolute inset-0 bg-gradient-to-b from-primary/90 via-primary/75 to-primary/90 lg:hidden" />
				{/* Desktop left-edge fade */}
				<div className="absolute inset-y-0 left-1/2 hidden w-32 bg-gradient-to-r from-primary to-transparent lg:block" />

				<div className="relative mx-auto grid min-h-[70vh] max-w-7xl lg:min-h-[92vh] lg:grid-cols-2">
					{/* Left column */}
					<div className="flex flex-col justify-center px-6 py-16 lg:px-12 lg:py-24">
						<h1
							data-testid="home-hero-heading"
							className="font-heading text-4xl leading-[1.1] font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
						>
							{t("hero.heading")}
						</h1>

						<p className="mt-4 max-w-md text-lg text-white/80">{t("hero.subheading")}</p>

						{/* Search bar */}
						<form
							onSubmit={handleSearch}
							data-testid="home-search-form"
							className="mt-8 flex max-w-lg gap-2 rounded-xl border border-white/20 bg-white/10 p-1.5 backdrop-blur-xl"
						>
							<input
								data-testid="home-search-input"
								name="q"
								type="text"
								placeholder={t("hero.searchPlaceholder")}
								className="h-10 flex-1 rounded-lg bg-transparent px-4 text-white placeholder:text-white/60 focus:outline-none"
							/>
							<button
								data-testid="home-search-submit"
								type="submit"
								className="h-10 rounded-lg bg-accent px-6 font-heading text-sm font-semibold text-white hover:bg-accent-hover"
							>
								{t("hero.searchButton")}
							</button>
						</form>

						{/* Quick filter chips */}
						<div className="mt-4 flex flex-wrap gap-2">
							{[
								{
									labelKey: "hero.chips.uusimaa" as const,
									slug: "uusimaa",
									search: { region: "uusimaa" },
								},
								{
									labelKey: "hero.chips.pirkanmaa" as const,
									slug: "pirkanmaa",
									search: { region: "pirkanmaa" },
								},
								{
									labelKey: "hero.chips.naked" as const,
									slug: "naked",
									search: { type: ["naked"] },
								},
								{
									labelKey: "hero.chips.a2" as const,
									slug: "a2",
									search: { license: ["A2"] },
								},
								{
									labelKey: "hero.chips.touring" as const,
									slug: "touring",
									search: { type: ["touring"] },
								},
							].map((chip) => (
								<Link
									key={chip.slug}
									data-testid={`home-chip-${chip.slug}`}
									to="/pyorat/myynti"
									search={chip.search}
									className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs text-white/90 backdrop-blur-xl transition-colors hover:bg-white/20 hover:text-white"
								>
									{t(chip.labelKey)}
								</Link>
							))}
						</div>

						{/* Stats */}
						<div className="mt-10 flex gap-8">
							<div>
								<p className="font-heading text-2xl font-bold text-accent">{stats.totalListings}</p>
								<p className="text-xs tracking-wide text-white/80 uppercase">
									{t("hero.statsListings")}
								</p>
							</div>
							<div>
								<p className="font-heading text-2xl font-bold text-accent">{stats.regionCount}</p>
								<p className="text-xs tracking-wide text-white/80 uppercase">
									{t("hero.statsRegions")}
								</p>
							</div>
							{stats.minPricePerDay > 0 && (
								<div>
									<p className="font-heading text-2xl font-bold text-accent">
										{stats.minPricePerDay} €
									</p>
									<p className="text-xs tracking-wide text-white/80 uppercase">
										{t("hero.statsPrice")}
									</p>
								</div>
							)}
						</div>
					</div>
				</div>
			</section>

			{/* Category showcase */}
			<section className="mx-auto max-w-6xl px-4 py-14">
				<h2 className="mb-8 font-heading text-2xl font-bold text-foreground">
					{t("categories.heading")}
				</h2>
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{categories.map((cat) => (
						<Link
							key={cat.key}
							to={CATEGORY_BROWSE_PATH[cat.key]}
							className="group flex flex-col gap-3 rounded-2xl border border-border bg-background p-5 transition-colors hover:bg-muted-light"
						>
							<span className="text-accent">{cat.icon}</span>
							<div className="flex-1">
								<p className="font-heading text-sm font-semibold text-foreground">
									{t(`${cat.labelKey}.label` as Parameters<typeof t>[0])}
								</p>
								<p className="mt-1 text-xs text-muted">
									{t(`${cat.labelKey}.desc` as Parameters<typeof t>[0])}
								</p>
							</div>
							<ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
						</Link>
					))}
				</div>
			</section>

			{/* Tabbed listings */}
			<section className="mx-auto max-w-6xl px-4 py-4 pb-16">
				<div className="mb-6 flex items-end justify-between">
					<h2 className="font-heading text-2xl font-bold text-foreground">
						{t("latestListings.heading")}
					</h2>
					<Link
						data-testid="home-browse-all"
						to={CATEGORY_BROWSE_PATH[activeTab]}
						className="flex items-center gap-1 text-sm font-medium text-accent hover:underline"
					>
						{t("latestListings.browseAll")}
						<ArrowRight className="h-4 w-4" />
					</Link>
				</div>

				{/* Tab bar */}
				<div className="mb-6 flex gap-1 rounded-xl border border-border bg-muted-light p-1">
					{tabs.map((tab) => (
						<button
							key={tab.key}
							type="button"
							onClick={() => setActiveTab(tab.key)}
							className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
								activeTab === tab.key
									? "bg-accent text-white shadow-sm"
									: "text-muted hover:text-foreground"
							}`}
						>
							{t(tab.labelKey)}
						</button>
					))}
				</div>

				{activeListings.length > 0 ? (
					<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
						{activeListings.slice(0, 6).map((listing) => (
							<ListingCard
								key={listing.id}
								listing={listing}
								images={listing.images}
								makeSlug={listing.makeSlug}
								modelName={listing.modelName}
							/>
						))}
					</div>
				) : (
					<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
						<p className="text-sm text-muted">{t("latestListings.browseAll")}</p>
						<Link
							to={CATEGORY_BROWSE_PATH[activeTab]}
							className="mt-4 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
						>
							{t("latestListings.browseAll")}
						</Link>
					</div>
				)}
			</section>

			{/* Lister CTA */}
			<section className="bg-primary px-4 py-16 text-center">
				<h2 className="font-heading text-2xl font-bold text-white">{t("cta.heading")}</h2>
				<p className="mt-2 text-white/70">{t("cta.body")}</p>
				{verified ? (
					<Link
						data-testid="home-add-listing-cta"
						to="/ilmoitukset/uusi"
						className="mt-6 inline-block rounded-lg bg-accent px-8 py-3 font-heading text-sm font-semibold text-white hover:bg-accent-hover"
					>
						{t("cta.button")}
					</Link>
				) : (
					<span
						data-testid="home-add-listing-cta"
						title={tAuth("unverifiedTooltip")}
						className="mt-6 inline-block cursor-not-allowed rounded-lg bg-white/20 px-8 py-3 font-heading text-sm font-semibold text-white/50"
					>
						{t("cta.button")}
					</span>
				)}
			</section>
		</div>
	);
}
