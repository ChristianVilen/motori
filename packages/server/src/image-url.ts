export function isValidImageUrl(url: string): boolean {
	const publicUrl = (process.env.STORAGE_PUBLIC_URL ?? "").replace(/\/$/, "");
	return url.startsWith("/api/uploads/") || (!!publicUrl && url.startsWith(`${publicUrl}/`));
}
