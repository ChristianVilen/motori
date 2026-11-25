import { formatEur, useTranslation } from "~/lib/i18n";

export function BookingAmount({ cents }: { cents: number }) {
	const { i18n } = useTranslation();
	const final = formatEur(cents, i18n.language);
	return (
		<>
			<span data-rolling-amount aria-hidden="true">
				{final}
			</span>
			<span className="sr-only">{final}</span>
		</>
	);
}
