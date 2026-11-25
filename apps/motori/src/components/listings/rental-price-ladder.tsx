import type { BookingCost } from "~/lib/bookings";
import type { ListingRental } from "~/lib/db/schema";
import { formatEur, useTranslation } from "~/lib/i18n";

export function RentalPriceLadder({
	rental,
	cost,
}: {
	rental: ListingRental;
	cost: BookingCost | null;
}) {
	const { t } = useTranslation("listings");
	const applied = cost ? (cost.label ?? "day") : null;
	const rates = [
		{ kind: "day", price: rental.price_per_day, id: "price-per-day" },
		{ kind: "weekend", price: rental.price_per_weekend, id: "price-per-weekend" },
		{ kind: "week", price: rental.price_per_week, id: "price-per-week" },
	] as const;
	return (
		<div data-testid="price-info" className="order-3 mt-3 min-[900px]:mt-0">
			<dl className="flex rounded-lg border border-border bg-card">
				{rates.map(
					(rate) =>
						rate.price != null && (
							<div
								key={rate.kind}
								data-testid={rate.id}
								data-applied={applied === rate.kind || undefined}
								className="min-w-0 flex-1 p-2.5 not-first:border-l not-first:border-border data-[applied]:rounded-lg data-[applied]:ring-2 data-[applied]:ring-inset data-[applied]:ring-foreground"
							>
								<dt className="text-xs leading-tight text-muted">
									{t(`booking.rates.${rate.kind}`)}
								</dt>
								<dd className="mt-1 font-heading text-lg font-bold tabular-nums">
									{formatEur(rate.price)}
								</dd>
							</div>
						),
				)}
			</dl>
			{!!rental.price_description && (
				<p className="mt-2 text-sm text-muted">{rental.price_description}</p>
			)}
		</div>
	);
}
