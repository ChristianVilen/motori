// jscanify ships no types. The bare "jscanify" export is the node build (canvas +
// jsdom) — browser code must import "jscanify/client" (src/jscanify.js).
declare module "jscanify/client" {
	interface Point {
		x: number;
		y: number;
	}
	interface CornerPoints {
		topLeftCorner: Point;
		topRightCorner: Point;
		bottomRightCorner: Point;
		bottomLeftCorner: Point;
	}
	/** getCornerPoints can miss a quadrant — that corner comes back undefined. */
	interface DetectedCorners {
		topLeftCorner: Point | undefined;
		topRightCorner: Point | undefined;
		bottomRightCorner: Point | undefined;
		bottomLeftCorner: Point | undefined;
	}
	/** Reads the global `cv` (OpenCV.js) at call time — set globalThis.cv before use. */
	export default class Jscanify {
		/** Returns the biggest contour (a cv.Mat the caller must delete), or null. */
		findPaperContour(image: unknown): { delete(): void } | null;
		getCornerPoints(contour: unknown): DetectedCorners;
		extractPaper(
			image: HTMLImageElement | HTMLCanvasElement,
			resultWidth: number,
			resultHeight: number,
			cornerPoints: CornerPoints,
		): HTMLCanvasElement;
		extractPaper(
			image: HTMLImageElement | HTMLCanvasElement,
			resultWidth: number,
			resultHeight: number,
		): HTMLCanvasElement | null;
	}
}
