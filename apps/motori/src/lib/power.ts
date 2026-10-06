const KW_PER_HV = 0.73549875;

// Always Finnish, not the active i18n language: the sale page and the contract are Finnish-only.
const kwFormat = new Intl.NumberFormat("fi-FI", { maximumFractionDigits: 1 });

// One decimal is enough for every whole hv value to survive the round trip hv → kW → hv.
export function roundKw(kw: number): number {
	return Math.round(kw * 10) / 10;
}

export function hvToKw(hv: number): number {
	return roundKw(hv * KW_PER_HV);
}

export function kwToHv(kw: number): number {
	return Math.round(kw / KW_PER_HV);
}

export function formatPower(kw: number): string {
	return `${kwFormat.format(kw)} kW (${kwToHv(kw)} hv)`;
}
