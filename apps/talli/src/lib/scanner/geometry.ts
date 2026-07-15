export interface Point {
	x: number;
	y: number;
}

export interface Corners {
	topLeftCorner: Point;
	topRightCorner: Point;
	bottomRightCorner: Point;
	bottomLeftCorner: Point;
}

export type CornerKey = keyof Corners;

export function fullImageCorners(width: number, height: number): Corners {
	return {
		topLeftCorner: { x: 0, y: 0 },
		topRightCorner: { x: width, y: 0 },
		bottomRightCorner: { x: width, y: height },
		bottomLeftCorner: { x: 0, y: height },
	};
}

function dist(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Output page size for a warped quad: the longer of each opposing edge pair. */
export function outputSize(c: Corners): { width: number; height: number } {
	return {
		width: Math.max(
			1,
			Math.round(
				Math.max(
					dist(c.topLeftCorner, c.topRightCorner),
					dist(c.bottomLeftCorner, c.bottomRightCorner),
				),
			),
		),
		height: Math.max(
			1,
			Math.round(
				Math.max(
					dist(c.topLeftCorner, c.bottomLeftCorner),
					dist(c.topRightCorner, c.bottomRightCorner),
				),
			),
		),
	};
}

/** Downscale a canvas so its long edge is at most maxEdge (returns input if already small). */
export function downscale(canvas: HTMLCanvasElement, maxEdge: number): HTMLCanvasElement {
	const scale = maxEdge / Math.max(canvas.width, canvas.height);
	if (scale >= 1) {
		return canvas;
	}
	const out = document.createElement("canvas");
	out.width = Math.round(canvas.width * scale);
	out.height = Math.round(canvas.height * scale);
	const ctx = out.getContext("2d");
	if (!ctx) {
		return canvas;
	}
	ctx.drawImage(canvas, 0, 0, out.width, out.height);
	return out;
}
