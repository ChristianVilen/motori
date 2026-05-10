import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import type { Listing } from "~/lib/db/schema";
import { formatEur } from "~/lib/i18n";

export interface NonRentalSidebarProps {
	price: number;
	priceTestId: string;
	negotiable?: boolean;
	statRows: Array<{ label: string; value: ReactNode }>;
	listing: Listing;
	isOwner: boolean;
	ownerPhoneVisible: boolean;
	ownerPhone: string | null;
	ownerUserId: string;
}

export function NonRentalSidebar({
	price,
	priceTestId,
	negotiable = false,
	statRows,
	listing,
	isOwner,
	ownerPhoneVisible,
	ownerPhone,
	ownerUserId,
}: NonRentalSidebarProps) {
	return (
		<div id="pricing" className="space-y-4 lg:self-start">
			<div className="rounded-l border border-border bg-card p-5 shadow-sm">
				<div data-testid="price-info" className="mb-4">
					<span data-testid={priceTestId} className="text-3xl font-bold text-accent">
						{formatEur(price)}
					</span>
					{negotiable && <span className="ml-2 text-sm text-muted">Hinta joustaa</span>}
				</div>
				{statRows.length > 0 && (
					<dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
						{statRows.map((row) => (
							<div key={row.label}>
								<dt className="text-muted">{row.label}</dt>
								<dd className="font-medium text-foreground">{row.value}</dd>
							</div>
						))}
					</dl>
				)}
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
