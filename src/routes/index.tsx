import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ListingCard } from "~/components/listings/listing-card";
import { useTranslation } from "~/lib/i18n";
import { getHomepageStats, getLatestListings } from "~/lib/listings-queries";

export const Route = createFileRoute("/")({
	loader: async () => {
		const [latestListings, stats] = await Promise.all([getLatestListings(), getHomepageStats()]);
		return { latestListings, stats };
	},
	component: HomePage,
});

function HomePage() {
	const { latestListings, stats } = Route.useLoaderData();
	const navigate = useNavigate();
	const { t } = useTranslation("home");

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
				<div className="absolute inset-0 bg-primary/85 lg:hidden" />
				{/* Desktop left-edge fade */}
				<div className="absolute inset-y-0 left-1/2 hidden w-32 bg-gradient-to-r from-primary to-transparent lg:block" />

				<div className="relative mx-auto grid min-h-[70vh] max-w-7xl lg:min-h-[92vh] lg:grid-cols-2">
					{/* Left column */}
					<div className="flex flex-col justify-center px-6 py-16 lg:px-12 lg:py-24">
						{/* Seasonal tag */}
						{isRidingSeason && (
							<div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
								<span className="relative flex h-2 w-2">
									<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
									<span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
								</span>
								<span className="text-sm text-white/70">{t("hero.seasonTag")}</span>
							</div>
						)}

						<h1
							data-testid="home-hero-heading"
							className="font-heading text-4xl leading-[1.1] font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
						>
							{t("hero.heading")} <span className="text-accent">{t("hero.headingAccent")}</span>
						</h1>

						<p className="mt-4 max-w-md text-lg text-white/60">{t("hero.subheading")}</p>

						{/* Search bar */}
						<form
							onSubmit={handleSearch}
							data-testid="home-search-form"
							className="mt-8 flex max-w-lg gap-2"
						>
							<input
								data-testid="home-search-input"
								name="q"
								type="text"
								placeholder={t("hero.searchPlaceholder")}
								className="h-12 flex-1 rounded-lg bg-white/10 px-4 text-white placeholder:text-white/40 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-accent"
							/>
							<button
								data-testid="home-search-submit"
								type="submit"
								className="h-12 rounded-lg bg-accent px-6 font-heading text-sm font-semibold text-white hover:bg-accent-hover"
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
								{ labelKey: "hero.chips.a2" as const, slug: "a2", search: { license: ["A2"] } },
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
									className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
								>
									{t(chip.labelKey)}
								</Link>
							))}
						</div>

						{/* Stats */}
						<div className="mt-10 flex gap-8">
							<div>
								<p className="font-heading text-2xl font-bold text-accent">{stats.totalListings}</p>
								<p className="text-xs tracking-wide text-white/40 uppercase">
									{t("hero.statsListings")}
								</p>
							</div>
							<div>
								<p className="font-heading text-2xl font-bold text-accent">{stats.regionCount}</p>
								<p className="text-xs tracking-wide text-white/40 uppercase">
									{t("hero.statsRegions")}
								</p>
							</div>
							{stats.minPricePerDay > 0 && (
								<div>
									<p className="font-heading text-2xl font-bold text-accent">
										{stats.minPricePerDay} €
									</p>
									<p className="text-xs tracking-wide text-white/40 uppercase">
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
							<ListingCard key={listing.id} listing={listing} images={listing.images} />
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

					<div className="grid grid-cols-1 gap-10 md:grid-cols-3">
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
							<div key={step.num} className="relative pl-16">
								<span className="absolute top-0 left-0 font-heading text-5xl font-bold text-white/5">
									{step.num}
								</span>
								<div className="mb-2 h-1 w-8 rounded-full bg-accent" />
								<h3 className="font-heading text-lg font-semibold text-white">{step.title}</h3>
								<p className="mt-1 text-sm leading-relaxed text-white/50">{step.desc}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Lister CTA */}
			<section className="px-4 py-16 text-center">
				<h2 className="font-heading text-2xl font-bold text-foreground">{t("cta.heading")}</h2>
				<p className="mt-2 text-muted">{t("cta.body")}</p>
				<Link
					data-testid="home-add-listing-cta"
					to="/ilmoitukset/uusi"
					className="mt-6 inline-block rounded-lg bg-accent px-8 py-3 font-heading text-sm font-semibold text-white hover:bg-accent-hover"
				>
					{t("cta.button")}
				</Link>
			</section>

			{/* Footer */}
			<footer className="border-t border-border px-4 py-8">
				<div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
					<p className="font-heading text-sm font-semibold text-foreground">{t("footer.brand")}</p>
					<div className="flex gap-6 text-xs text-muted">
						<Link to="/ilmoitukset" className="hover:text-foreground">
							{t("footer.browseListings")}
						</Link>
						<Link to="/ilmoitukset/uusi" className="hover:text-foreground">
							{t("footer.addListing")}
						</Link>
					</div>
					<p className="text-xs text-muted">
						{t("footer.copyright", { year: new Date().getFullYear() })}
					</p>
				</div>
			</footer>
		</div>
	);
}
