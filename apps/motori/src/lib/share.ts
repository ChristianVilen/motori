export function buildShareLinks(url: string, title: string) {
	return {
		whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
		facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
	};
}
