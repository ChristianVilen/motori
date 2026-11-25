import { centsToEuros } from "~/lib/currency";

export function formatEur(cents: number, locale: string): string {
	const fractionDigits = cents % 100 === 0 ? 0 : 2;
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "EUR",
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	}).format(centsToEuros(cents));
}

export function formatNumber(n: number, locale: string): string {
	return new Intl.NumberFormat(locale).format(n);
}

export function formatDate(d: Date, locale: string, opts?: Intl.DateTimeFormatOptions): string {
	return new Intl.DateTimeFormat(locale, { timeZone: "Europe/Helsinki", ...opts }).format(d);
}
