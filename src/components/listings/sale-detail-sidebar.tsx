import { Link } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { formatEur } from "~/lib/i18n";
import type { Listing } from "~/lib/db/schema";

const CONDITION_LABELS: Record<string, string> = {
  new: "Uusi",
  excellent: "Erinomainen",
  good: "Hyvä",
  fair: "Tyydyttävä",
  poor: "Huono",
};

interface SaleDetailSidebarProps {
  listing: Listing;
  sale: { price: number; condition: string; km_driven: number | null; negotiable: boolean };
  isOwner: boolean;
  ownerPhoneVisible: boolean;
  ownerPhone: string | null;
  ownerUserId: string;
}

export function SaleDetailSidebar({
  listing,
  sale,
  isOwner,
  ownerPhoneVisible,
  ownerPhone,
  ownerUserId,
}: SaleDetailSidebarProps) {
  return (
    <div id="pricing" className="space-y-4 lg:self-start">
      <div className="rounded-l border border-border bg-card p-5 shadow-sm">
        <div data-testid="price-info" className="mb-4">
          <span data-testid="price-sale" className="text-3xl font-bold text-accent">
            {formatEur(sale.price)}
          </span>
          {sale.negotiable && (
            <span className="ml-2 text-sm text-muted">Hinta joustaa</span>
          )}
        </div>
        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-muted">Kunto</dt>
            <dd className="font-medium text-foreground">
              {CONDITION_LABELS[sale.condition] ?? sale.condition}
            </dd>
          </div>
          {sale.km_driven != null && (
            <div>
              <dt className="text-muted">Kilometrit</dt>
              <dd className="font-medium text-foreground">
                {sale.km_driven.toLocaleString("fi")} km
              </dd>
            </div>
          )}
        </dl>
        {isOwner ? (
          <div className="flex gap-2">
            <Link
              to="/ilmoitukset/$listingId/muokkaa"
              params={{ listingId: listing.short_id }}
              className="flex-1"
            >
              <Button variant="outline" className="w-full" size="sm">
                Muokkaa
              </Button>
            </Link>
            <Link to="/omat" className="flex-1">
              <Button variant="outline" className="w-full" size="sm">
                Omat ilmoitukset
              </Button>
            </Link>
          </div>
        ) : listing.status === "active" ? (
          ownerPhoneVisible && ownerPhone ? (
            <a
              href={`tel:${ownerPhone}`}
              className="block w-full rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover"
            >
              {ownerPhone}
            </a>
          ) : (
            <Link
              to="/profiili/$userId"
              params={{ userId: ownerUserId }}
              className="block w-full rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-accent-hover"
            >
              Ota yhteyttä
            </Link>
          )
        ) : null}
      </div>
    </div>
  );
}
