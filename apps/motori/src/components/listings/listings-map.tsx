import { motionAllowed } from "~/lib/motion";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useTranslation } from "~/lib/i18n";
import { findMunicipality } from "~/lib/municipalities";

interface MapPin {
	city: string;
	lat: number;
	lng: number;
	count: number;
}

interface ListingsMapProps {
	cities: { city: string; count: number }[];
	onCityClick?: (city: string) => void;
	selectedCity?: string | null;
	className?: string;
}

const FINLAND_BOUNDS: L.LatLngBoundsExpression = [
	[59.7, 19.5],
	[70.1, 31.6],
];

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

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
	const selected = selectedCity ? findMunicipality(selectedCity) : undefined;
	const bounds =
		!selected && pins.length
			? L.latLngBounds(pins.map((pin) => L.latLng(pin.lat, pin.lng)))
			: undefined;
	const south = bounds?.getSouth(),
		west = bounds?.getWest();
	const north = bounds?.getNorth(),
		east = bounds?.getEast();

	useEffect(() => {
		const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
		observer.observe(map.getContainer());
		return () => observer.disconnect();
	}, [map]);

	useEffect(() => {
		map.invalidateSize({ pan: false });
		if (selected) {
			map.setView([selected.lat, selected.lng], 9, { animate: false });
		} else if (
			south !== undefined &&
			west !== undefined &&
			north !== undefined &&
			east !== undefined
		) {
			map.fitBounds(
				[
					[south, west],
					[north, east],
				],
				{ padding: [40, 40], maxZoom: 10, animate: false },
			);
		}
	}, [map, selected, south, west, north, east]);
	return null;
}

function CityMarker({
	pin,
	active,
	onCityClick,
}: {
	pin: MapPin;
	active: boolean;
	onCityClick?: (city: string) => void;
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
								onCityClick(pin.city);
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

export function ListingsMap({ cities, onCityClick, selectedCity, className }: ListingsMapProps) {
	const { t } = useTranslation("listings");
	const pins = useMemo(
		() =>
			cities.flatMap(({ city, count }) => {
				const place = findMunicipality(city);
				return place ? [{ city, count, lat: place.lat, lng: place.lng }] : [];
			}),
		[cities],
	);

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
