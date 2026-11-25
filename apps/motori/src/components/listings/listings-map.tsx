import { motionAllowed } from "~/lib/motion";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useTranslation } from "~/lib/i18n";
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

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

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
		iconSize: active ? [38, 38] : [32, 32],
		iconAnchor: active ? [19, 19] : [16, 16],
	});
}

function FitBounds({ pins, selectedCity }: { pins: MapPin[]; selectedCity?: string | null }) {
	const map = useMap();

	useEffect(() => {
		function framePins() {
			map.invalidateSize({ pan: false });
			const selected = pins.find((pin) => pin.city === selectedCity);
			if (selected) {
				map.setView([selected.lat, selected.lng], 9, { animate: false });
			} else if (pins.length) {
				map.fitBounds(L.latLngBounds(pins.map((p) => L.latLng(p.lat, p.lng))), {
					padding: [40, 40],
					maxZoom: 10,
					animate: false,
				});
			}
		}
		framePins();
		const observer = new ResizeObserver(framePins);
		observer.observe(map.getContainer());
		return () => observer.disconnect();
	}, [selectedCity, map, pins]);

	return null;
}

function CityMarker({
	pin,
	active,
	onCityClick,
}: {
	pin: MapPin;
	active: boolean;
	onCityClick?: (city: string, listingIds: string[]) => void;
}) {
	const icon = useMemo(() => createCountIcon(pin.count, active), [pin.count, active]);

	return (
		<Marker
			position={[pin.lat, pin.lng]}
			title={pin.city}
			icon={icon}
			zIndexOffset={active ? 1000 : 0}
			eventHandlers={
				onCityClick
					? {
							click: () => {
								onCityClick(pin.city, pin.listingIds);
							},
						}
					: undefined
			}
		>
			<Tooltip direction="top">
				{pin.city} ({pin.count})
			</Tooltip>
		</Marker>
	);
}

export function ListingsMap({ listings, onCityClick, selectedCity, className }: ListingsMapProps) {
	const { t } = useTranslation("listings");
	const pins = useMemo(() => groupByCity(listings), [listings]);

	return (
		<MapContainer
			zoomAnimation={motionAllowed()}
			fadeAnimation={motionAllowed()}
			markerZoomAnimation={motionAllowed()}
			inertia={motionAllowed()}
			bounds={FINLAND_BOUNDS}
			scrollWheelZoom
			className={className ?? "h-full w-full"}
		>
			<TileLayer
				url={TILE_URL}
				attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">${t("browse.mapContributors")}</a>`}
				maxZoom={19}
			/>
			<FitBounds pins={pins} selectedCity={selectedCity} />
			{pins.map((pin) => (
				<CityMarker
					key={pin.city}
					pin={pin}
					active={pin.city === selectedCity}
					onCityClick={onCityClick}
				/>
			))}
		</MapContainer>
	);
}
