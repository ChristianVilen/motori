import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ListingCard } from "~/components/listings/listing-card";
import { useTranslation } from "~/lib/i18n";
import { getHomepageStats, getLatestListings } from "~/lib/listings-queries";
import { getSession } from "~/lib/session";

export const Route = createFileRoute("/")({
	loader: async () => {
		const [latestListings, stats, session] = await Promise.all([
			getLatestListings(),
			getHomepageStats(),
			getSession(),
		]);
		// Logged-out users are treated as verified so they see enabled links;
		// server auth middleware handles actual gating.
		const emailVerified = session?.user.emailVerified ?? true;
		return { latestListings, stats, emailVerified };
	},
	component: HomePage,
});

function HomePage() {
	const { latestListings, stats, emailVerified: verified } = Route.useLoaderData();
	const navigate = useNavigate();
	const { t } = useTranslation("home");
	const { t: tAuth } = useTranslation("auth");

	const isRidingSeason = (() => {
		const month = new Date().getMonth();
		return month >= 3 && month <= 9;
	})();

	function handleSearch(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const q = (formData.get("q") as string)?.trim() || undefined;
		navigate({
			to: "/ilmoitukset",
			search: q ? { q } : {},
		});
	}

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
				<div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-primary/60 to-primary/80 lg:hidden" />
				{/* Desktop left-edge fade */}
				<div className="absolute inset-y-0 left-1/2 hidden w-32 bg-gradient-to-r from-primary to-transparent lg:block" />

				<div className="relative mx-auto grid min-h-[70vh] max-w-7xl lg:min-h-[92vh] lg:grid-cols-2">
					{/* Left column */}
					<div className="flex flex-col justify-center px-6 py-16 lg:px-12 lg:py-24">
						{/* Seasonal tag */}
						{isRidingSeason && (
							<div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 backdrop-blur-xl">
								<span className="relative flex h-2 w-2">
									<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
									<span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
								</span>
								<span className="text-sm text-white/80">{t("hero.seasonTag")}</span>
							</div>
						)}

						<h1
							data-testid="home-hero-heading"
							className="font-heading text-4xl leading-[1.1] font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
						>
							{t("hero.heading")} <span className="text-accent">{t("hero.headingAccent")}</span>
						</h1>

						<p className="mt-4 max-w-md text-lg text-white/70">{t("hero.subheading")}</p>

						{/* Search bar */}
						<form
							onSubmit={handleSearch}
							data-testid="home-search-form"
							className="mt-8 flex max-w-lg gap-2 rounded-l border border-white/20 bg-white/10 p-1.5 backdrop-blur-xl"
						>
							<input
								data-testid="home-search-input"
								name="q"
								type="text"
								placeholder={t("hero.searchPlaceholder")}
								className="h-10 flex-1 rounded-lg bg-transparent px-4 text-white placeholder:text-white/50 focus:outline-none"
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
									to="/ilmoitukset"
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
								<p className="text-xs tracking-wide text-white/70 uppercase">
									{t("hero.statsListings")}
								</p>
							</div>
							<div>
								<p className="font-heading text-2xl font-bold text-accent">{stats.regionCount}</p>
								<p className="text-xs tracking-wide text-white/70 uppercase">
									{t("hero.statsRegions")}
								</p>
							</div>
							{stats.minPricePerDay > 0 && (
								<div>
									<p className="font-heading text-2xl font-bold text-accent">
										{stats.minPricePerDay} €
									</p>
									<p className="text-xs tracking-wide text-white/70 uppercase">
										{t("hero.statsPrice")}
									</p>
								</div>
							)}
						</div>
					</div>
				</div>
			</section>

			{/* Seasonal strip */}
			<div className="bg-gradient-to-r from-accent to-accent-hover px-4 py-3 text-center text-sm font-medium text-white">
				{isRidingSeason
					? t("seasonalStrip.active", { total: stats.totalListings })
					: t("seasonalStrip.inactive")}
			</div>

			{/* Latest listings */}
			{latestListings.length > 0 && (
				<section className="mx-auto max-w-6xl px-4 py-16">
					<div className="mb-8 flex items-end justify-between">
						<div>
							<h2 className="font-heading text-2xl font-bold text-foreground">
								{t("latestListings.heading")}
							</h2>
							<p className="mt-1 text-sm text-muted">{t("latestListings.subheading")}</p>
						</div>
						<Link
							data-testid="home-browse-all"
							to="/ilmoitukset"
							search={{ sort: "newest" }}
							className="flex items-center gap-1 text-sm font-medium text-accent hover:underline"
						>
							{t("latestListings.browseAll")}
							<ArrowRight className="h-4 w-4" />
						</Link>
					</div>

					<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
						{latestListings.slice(0, 6).map((listing) => (
							<ListingCard key={listing.id} listing={listing} images={listing.images} makeSlug={listing.makeSlug} modelName={listing.modelName} />
						))}
					</div>
				</section>
			)}

			{/* How it works */}
			<section className="bg-primary px-4 py-16">
				<div className="mx-auto max-w-4xl">
					<h2 className="mb-12 text-center font-heading text-2xl font-bold text-white">
						{t("howItWorks.heading")}
					</h2>

					<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
						{[
							{
								num: "01",
								title: t("howItWorks.step1.title"),
								desc: t("howItWorks.step1.desc"),
							},
							{
								num: "02",
								title: t("howItWorks.step2.title"),
								desc: t("howItWorks.step2.desc"),
							},
							{
								num: "03",
								title: t("howItWorks.step3.title"),
								desc: t("howItWorks.step3.desc"),
							},
						].map((step) => (
							<div key={step.num} className="rounded-l border border-white/10 bg-white/[0.05] p-6">
								<span className="font-heading text-3xl font-bold text-orange-400">{step.num}</span>
								<h3 className="mt-3 font-heading text-lg font-semibold text-white">{step.title}</h3>
								<p className="mt-2 text-sm leading-relaxed text-white/70">{step.desc}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Lister CTA */}
			<section className="px-4 py-16 text-center">
				<h2 className="font-heading text-2xl font-bold text-foreground">{t("cta.heading")}</h2>
				<p className="mt-2 text-muted">{t("cta.body")}</p>
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
						className="mt-6 inline-block cursor-not-allowed rounded-lg bg-muted-light px-8 py-3 font-heading text-sm font-semibold text-muted"
					>
						{t("cta.button")}
					</span>
				)}
			</section>
		</div>
	);
}
