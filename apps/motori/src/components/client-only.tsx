import { useEffect, useState } from "react";

/** Renders children only on the client (avoids SSR of browser-only code like Leaflet). */
export function ClientOnly({
	children,
	fallback,
}: {
	children: React.ReactNode;
	fallback?: React.ReactNode;
}) {
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	return mounted ? children : (fallback ?? null);
}
