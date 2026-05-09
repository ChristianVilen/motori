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
const GEAR_TYPE_LABELS: Record<string, string> = {
  helmet: "Kypärä",
  jacket: "Takki",
  pants: "Housut",
  boots: "Saappaat",
  gloves: "Käsineet",
  other: "Muu",
};

interface GearDetailSidebarProps {
  listing: Listing;
  gear: { gear_type: string; size: string | null; condition: string; price: number };
  isOwner: boolean;
  ownerPhoneVisible: boolean;
  ownerPhone: string | null;
  ownerUserId: string;
}

export function GearDetailSidebar({
  listing,
  gear,
  isOwner,
  ownerPhoneVisible,
  ownerPhone,
  ownerUserId,
}: GearDetailSidebarProps) {
  return (
    <div id="pricing" className="space-y-4 lg:self-start">
      <div className="rounded-l border border-border bg-card p-5 shadow-sm">
        <div data-testid="price-info" className="mb-4">
          <span data-testid="price-gear" className="text-3xl font-bold text-accent">
            {formatEur(gear.price)}
          </span>
        </div>
        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-muted">Tyyppi</dt>
            <dd className="font-medium text-foreground">
              {GEAR_TYPE_LABELS[gear.gear_type] ?? gear.gear_type}
            </dd>
          </div>
          {gear.size && (
            <div>
              <dt className="text-muted">Koko</dt>
              <dd className="font-medium text-foreground">{gear.size}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted">Kunto</dt>
            <dd className="font-medium text-foreground">
              {CONDITION_LABELS[gear.condition] ?? gear.condition}
            </dd>
          </div>
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
