import type Jscanify from "jscanify/client";
import { type Corners, downscale, fullImageCorners, outputSize } from "~/lib/scanner/geometry";

// OpenCV.js is ~10 MB of WASM — everything here is dynamic-import'ed so it only
// loads on the scanner route, never in the main bundle or on the server.

interface OpenCv {
	Mat?: unknown;
	imread(source: HTMLImageElement | HTMLCanvasElement): { delete(): void };
	onRuntimeInitialized?: () => void;
}

interface Loaded {
	scanner: Jscanify;
	cv: OpenCv;
}

let loading: Promise<Loaded> | null = null;

export function loadScanner(): Promise<Loaded> {
	if (!loading) {
		loading = (async () => {
			// 5.x exports the emscripten factory's return value: normally a promise of
			// the cv module, so `await` unwraps it. The pre-initialized-module shape
			// (cv.Mat present, or onRuntimeInitialized pending) is kept as a fallback —
			// it's the documented alternative signal.
			const cvModule = (await import("@techstark/opencv-js")) as unknown as {
				default: OpenCv | Promise<OpenCv>;
			};
			const cv = await cvModule.default;
			if (!cv.Mat) {
				await new Promise<void>((resolve) => {
					cv.onRuntimeInitialized = () => resolve();
				});
			}
			// jscanify's browser build reads the global `cv` at call time.
			(globalThis as { cv?: OpenCv }).cv = cv;
			const { default: JscanifyCtor } = await import("jscanify/client");
			return { scanner: new JscanifyCtor(), cv };
		})();
		loading.catch(() => {
			loading = null; // allow retry after a failed load
		});
	}
	return loading;
}

/** Detect document corners; falls back to the full image when detection fails. */
export async function detectCorners(img: HTMLImageElement): Promise<Corners> {
	const fallback = fullImageCorners(img.naturalWidth, img.naturalHeight);
	try {
		const { scanner, cv } = await loadScanner();
		const mat = cv.imread(img);
		try {
			const contour = scanner.findPaperContour(mat);
			if (!contour) {
				return fallback;
			}
			try {
				const c = scanner.getCornerPoints(contour);
				if (!c.topLeftCorner || !c.topRightCorner || !c.bottomRightCorner || !c.bottomLeftCorner) {
					return fallback;
				}
				return {
					topLeftCorner: c.topLeftCorner,
					topRightCorner: c.topRightCorner,
					bottomRightCorner: c.bottomRightCorner,
					bottomLeftCorner: c.bottomLeftCorner,
				};
			} finally {
				contour.delete();
			}
		} finally {
			mat.delete();
		}
	} catch {
		return fallback;
	}
}

/** Perspective-correct the quad out of the photo, downscaled to max 2000 px long edge. */
export async function extractPage(
	img: HTMLImageElement,
	corners: Corners,
): Promise<HTMLCanvasElement> {
	const { scanner } = await loadScanner();
	const { width, height } = outputSize(corners);
	const canvas = scanner.extractPaper(img, width, height, corners);
	return downscale(canvas, 2000);
}
