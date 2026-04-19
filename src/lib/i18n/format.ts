import i18n from "i18next";

function activeLocale(): string {
	return i18n.language || "fi";
}

export function formatEur(cents: number): string {
	const amount = cents / 100;
	return new Intl.NumberFormat(activeLocale(), {
		style: "currency",
		currency: "EUR",
	}).format(amount);
}

export function formatDate(d: Date, opts?: Intl.DateTimeFormatOptions): string {
	return new Intl.DateTimeFormat(activeLocale(), opts).format(d);
}
