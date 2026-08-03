import { useRef, useState } from "react";
import type { CornerKey, Corners, Point } from "~/lib/scanner/geometry";

const CORNER_KEYS: CornerKey[] = [
	"topLeftCorner",
	"topRightCorner",
	"bottomRightCorner",
	"bottomLeftCorner",
];

interface CornerAdjustProps {
	src: string;
	width: number;
	height: number;
	corners: Corners;
	onChange: (corners: Corners) => void;
}

export function CornerAdjust({ src, width, height, corners, onChange }: CornerAdjustProps) {
	const svgRef = useRef<SVGSVGElement>(null);
	const [dragging, setDragging] = useState<CornerKey | null>(null);
	// Handle radius in viewBox units ≈ constant on-screen size across photo resolutions.
	const r = Math.max(width, height) / 28;

	function toImagePoint(e: React.PointerEvent): Point {
		const svg = svgRef.current;
		if (!svg) {
			return { x: 0, y: 0 };
		}
		const rect = svg.getBoundingClientRect();
		return {
			x: Math.min(width, Math.max(0, ((e.clientX - rect.left) / rect.width) * width)),
			y: Math.min(height, Math.max(0, ((e.clientY - rect.top) / rect.height) * height)),
		};
	}

	const points = CORNER_KEYS.map((k) => `${corners[k].x},${corners[k].y}`).join(" ");

	return (
		<svg
			ref={svgRef}
			viewBox={`0 0 ${width} ${height}`}
			className="w-full touch-none select-none rounded border border-border"
			data-testid="corner-adjust"
			onPointerMove={(e) => {
				if (dragging) {
					onChange({ ...corners, [dragging]: toImagePoint(e) });
				}
			}}
			onPointerUp={() => setDragging(null)}
			onPointerCancel={() => setDragging(null)}
			role="img"
		>
			<title>Rajaa dokumentti vetämällä kulmista</title>
			<image href={src} width={width} height={height} />
			<polygon
				points={points}
				fill="rgb(37 99 235 / 0.15)"
				stroke="rgb(37 99 235)"
				strokeWidth={r / 4}
			/>
			{CORNER_KEYS.map((k) => (
				<circle
					key={k}
					cx={corners[k].x}
					cy={corners[k].y}
					r={r}
					fill="rgb(37 99 235 / 0.5)"
					stroke="white"
					strokeWidth={r / 5}
					onPointerDown={(e) => {
						svgRef.current?.setPointerCapture(e.pointerId);
						setDragging(k);
					}}
				/>
			))}
		</svg>
	);
}
