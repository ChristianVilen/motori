import { Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { ListingGallery } from "~/components/listings/listing-gallery";
import { ReportButton } from "~/components/report-button";
import { LICENSE_CLASSES, LISTING_STATUSES, MOTORCYCLE_TYPES, REGIONS } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import type { ListingForDisplay } from "~/lib/listings-queries";

interface ReviewSummary {
  averageRating: number | null;
  reviewCount: number;
}

export interface ListingDetailShellProps {
  data: ListingForDisplay & { ownerReviewSummary: ReviewSummary };
  session: { user: { id: string } } | null;
  backTo: string;
  backLabel: string;
  sidebar: ReactNode;
  mobileBar?: ReactNode;
}

export function ListingDetailShell({
  data,
  session,
  backTo,
  backLabel,
  sidebar,
  mobileBar,
}: ListingDetailShellProps) {
  const { t } = useTranslation("listings");
  const { t: tProfile } = useTranslation("profile");
  const { listing, images, ownerReviewSummary } = data;

  const isOwner = session?.user.id === listing.owner_id;
  const regionLabel = REGIONS.find((r) => r.value === listing.region)?.label ?? listing.region;
  const typeLabel =
    MOTORCYCLE_TYPES.find((mt) => mt.value === listing.motorcycle_type)?.label ??
    listing.motorcycle_type;
  const licenseLabel =
    LICENSE_CLASSES.find((l) => l.value === listing.required_license)?.label ?? null;
  const statusLabel = LISTING_STATUSES[listing.status];

  return (
    <div data-testid="listing-detail" className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="mx-auto max-w-4xl px-4 py-4 md:py-8">
        <Link
          data-testid="listing-detail-back"
          to={backTo as never}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:gap-8">
          <div className="space-y-4">
            <ListingGallery images={images} title={listing.title} />

            <div>
              <div className="flex items-start justify-between gap-3">
                <h1
                  data-testid="listing-detail-title"
                  className="text-xl font-bold text-primary md:text-2xl"
                >
                  {listing.title}
                </h1>
                <div className="flex shrink-0 gap-2">
                  {!!isOwner && (
                    <span className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                      {t("card.ownBadge")}
                    </span>
                  )}
                  {listing.status !== "active" && (
                    <span
                      data-testid="listing-status-badge"
                      className="rounded bg-warning/20 px-2 py-1 text-xs font-medium text-warning"
                    >
                      {statusLabel}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {!!typeLabel && (
                  <span
                    data-testid="listing-type"
                    className="flex items-center gap-1 rounded-full bg-muted-light px-2.5 py-0.5 text-xs text-muted"
                  >
                    <Tag className="h-3 w-3" />
                    {typeLabel}
                  </span>
                )}
                <span
                  data-testid="location-info"
                  className="flex items-center gap-1 rounded-full bg-muted-light px-2.5 py-0.5 text-xs text-muted"
                >
                  <MapPin className="h-3 w-3" />
                  {listing.city}, {regionLabel}
                </span>
                {!!licenseLabel && (
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                    {t("detail.licenseBadge", { license: licenseLabel })}
                  </span>
                )}
                {ownerReviewSummary.averageRating !== null && (
                  <Link
                    to="/profiili/$userId"
                    params={{ userId: listing.owner_id }}
                    className="rounded-full bg-muted-light px-2.5 py-0.5 text-xs text-muted hover:text-accent"
                  >
                    {ownerReviewSummary.reviewCount === 1
                      ? tProfile("reviews.summaryOne", { rating: ownerReviewSummary.averageRating })
                      : tProfile("reviews.summary", {
                          rating: ownerReviewSummary.averageRating,
                          count: ownerReviewSummary.reviewCount,
                        })}
                  </Link>
                )}
              </div>
            </div>

            <div>
              <h2 className="mb-1.5 text-sm font-semibold text-foreground">
                {t("detail.description")}
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                {listing.description}
              </p>
            </div>

            {!!session && (
              <div className="text-center">
                <ReportButton targetType="listing" targetId={listing.id} />
              </div>
            )}
          </div>

          {sidebar}
        </div>
      </div>
      {mobileBar}
    </div>
  );
}
