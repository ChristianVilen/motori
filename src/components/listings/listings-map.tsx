import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { findMunicipality } from "~/lib/municipalities";

export interface MapPin {
	city: string;
	lat: number;
	lng: number;
	count: number;
	listingIds: string[];
}

interface ListingsMapProps {
	listings: { id: string; city: string; short_id: string }[];
	onCityClick?: (city: string, listingIds: string[]) => void;
	selectedCity?: string | null;
	className?: string;
}

const FINLAND_BOUNDS: L.LatLngBoundsExpression = [
	[59.7, 19.5],
	[70.1, 31.6],
];

export function groupByCity(listings: ListingsMapProps["listings"]): MapPin[] {
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
			map.set(m.name, {
				city: m.name,
				lat: m.lat,
				lng: m.lng,
				count: 1,
				listingIds: [l.short_id],
			});
		}
	}
	return Array.from(map.values());
}

function createCountIcon(count: number, active: boolean): L.DivIcon {
	const cls = active ? "motori-map-badge motori-map-badge--active" : "motori-map-badge";
	return L.divIcon({
		html: `<div class="${cls}">${count}</div>`,
		className: "",
		iconSize: [32, 32],
		iconAnchor: [16, 16],
	});
}

export function ListingsMap({ listings, onCityClick, selectedCity, className }: ListingsMapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<L.Map | null>(null);
	const markersRef = useRef<L.Marker[]>([]);

	useEffect(() => {
		if (!containerRef.current || mapRef.current) {
			return;
		}
		const map = L.map(containerRef.current, {
			zoomControl: true,
			scrollWheelZoom: true,
		}).fitBounds(FINLAND_BOUNDS);

		L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
			maxZoom: 19,
			subdomains: "abcd",
		}).addTo(map);

		mapRef.current = map;
		return () => {
			map.remove();
			mapRef.current = null;
		};
	}, []);

	// Update markers when listings or selectedCity change
	useEffect(() => {
		const map = mapRef.current;
		if (!map) {
			return;
		}

		// Clear existing markers
		for (const m of markersRef.current) {
			map.removeLayer(m);
		}
		markersRef.current = [];

		const pins = groupByCity(listings);
		for (const pin of pins) {
			const isActive = pin.city === selectedCity;
			const marker = L.marker([pin.lat, pin.lng], {
				icon: createCountIcon(pin.count, isActive),
				zIndexOffset: isActive ? 1000 : 0,
			})
				.addTo(map)
				.bindTooltip(`${pin.city} (${pin.count})`, { direction: "top" });

			if (onCityClick) {
				marker.on("click", () => {
					onCityClick(pin.city, pin.listingIds);
					map.setView([pin.lat, pin.lng], 9, { animate: true });
				});
			}

			markersRef.current.push(marker);
		}

		// Fit bounds to pins if no city is selected
		if (!selectedCity && pins.length > 0) {
			const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as L.LatLngTuple));
			map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
		}
	}, [listings, onCityClick, selectedCity]);

	return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}
