import i18n from "i18next";
import { centsToEuros } from "~/lib/currency";

function activeLocale(): string {
	return i18n.language || "fi";
}

export function formatEur(cents: number): string {
	const fractionDigits = cents % 100 === 0 ? 0 : 2;
	return new Intl.NumberFormat(activeLocale(), {
		style: "currency",
		currency: "EUR",
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	}).format(centsToEuros(cents));
}

export function formatNumber(n: number): string {
	return new Intl.NumberFormat(activeLocale()).format(n);
}

export function formatDate(d: Date, opts?: Intl.DateTimeFormatOptions): string {
	return new Intl.DateTimeFormat(activeLocale(), opts).format(d);
}
