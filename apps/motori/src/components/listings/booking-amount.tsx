import { formatEur } from "~/lib/i18n";

export function BookingAmount({ cents }: { cents: number }) {
	const final = formatEur(cents);
	return (
		<>
			<span data-rolling-amount aria-hidden="true">
				{final}
			</span>
			<span className="sr-only">{final}</span>
		</>
	);
}
