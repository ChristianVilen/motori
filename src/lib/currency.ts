export function eurosToCents(euros: number): number {
	return Math.round(euros * 100);
}

export function centsToEuros(cents: number): number {
	return cents / 100;
}
