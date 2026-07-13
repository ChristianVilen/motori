/** Vehicle service cost (EUR cents) → Finnish euro string. */
export function formatEur(cents: number): string {
	return `${(cents / 100).toLocaleString("fi-FI", { minimumFractionDigits: 0 })} €`;
}

/**
 * An interval reminder's km/month thresholds as Finnish text, e.g. "6000 km / 12 kk".
 * `suffix` is appended after each unit (" välein" for the reminders list).
 */
export function formatInterval(km: number | null, months: number | null, suffix = ""): string {
	return [km ? `${km} km${suffix}` : null, months ? `${months} kk${suffix}` : null]
		.filter(Boolean)
		.join(" / ");
}

/** A vehicle's display label: nickname if set, else "make model". */
export function vehicleLabel(v: { nickname: string | null; make: string; model: string }): string {
	return v.nickname ?? `${v.make} ${v.model}`;
}
