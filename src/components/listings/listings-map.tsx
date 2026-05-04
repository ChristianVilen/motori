import "leaflet/dist/leaflet.css";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
// Fix default marker icons (Leaflet + bundlers issue)
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { useEffect, useRef } from "react";
import { findMunicipality } from "~/lib/municipalities";

L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

interface MapPin {
	city: string;
	lat: number;
	lng: number;
	count: number;
	listingIds: string[];
}

interface ListingsMapProps {
	listings: { id: string; city: string; short_id: string }[];
	onPinClick?: (listingId: string) => void;
	className?: string;
}

/** Finland bounding box */
const FINLAND_BOUNDS: L.LatLngBoundsExpression = [
	[59.7, 19.5],
	[70.1, 31.6],
];

function groupByCity(listings: ListingsMapProps["listings"]): MapPin[] {
	const map = new Map<string, MapPin>();
	for (const l of listings) {
		const m = findMunicipality(l.city);
		if (!m) {
			continue;
		}
		const existing = map.get(m.name);
		if (existing) {
			existing.count++;
			existing.listingIds.push(l.short_id);
		} else {
			map.set(m.name, { city: m.name, lat: m.lat, lng: m.lng, count: 1, listingIds: [l.short_id] });
		}
	}
	return Array.from(map.values());
}

function createCountIcon(count: number): L.DivIcon {
	if (count === 1) {
		return new L.Icon.Default();
	}
	return L.divIcon({
		html: `<div style="background:#e85d04;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.3)">${count}</div>`,
		className: "",
		iconSize: [32, 32],
		iconAnchor: [16, 16],
	});
}

export function ListingsMap({ listings, onPinClick, className }: ListingsMapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<L.Map | null>(null);

	useEffect(() => {
		if (!containerRef.current || mapRef.current) {
			return;
		}
		const map = L.map(containerRef.current, {
			zoomControl: true,
			scrollWheelZoom: true,
		}).fitBounds(FINLAND_BOUNDS);

		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
			maxZoom: 18,
		}).addTo(map);

		mapRef.current = map;
		return () => {
			map.remove();
			mapRef.current = null;
		};
	}, []);

	// Update markers when listings change
	useEffect(() => {
		const map = mapRef.current;
		if (!map) {
			return;
		}

		// Clear existing markers
		map.eachLayer((layer) => {
			if (layer instanceof L.Marker) {
				map.removeLayer(layer);
			}
		});

		const pins = groupByCity(listings);
		for (const pin of pins) {
			const marker = L.marker([pin.lat, pin.lng], { icon: createCountIcon(pin.count) })
				.addTo(map)
				.bindTooltip(`${pin.city} (${pin.count})`, { direction: "top" });

			if (onPinClick) {
				marker.on("click", () => onPinClick(pin.listingIds[0]));
			}
		}

		// Fit bounds to pins if any
		if (pins.length > 0) {
			const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as L.LatLngTuple));
			map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
		}
	}, [listings, onPinClick]);

	return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}
