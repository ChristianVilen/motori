export const motionEase = "cubic-bezier(0.2, 0.8, 0.2, 1)";
export const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

export function motionAllowed() {
	return typeof window !== "undefined" && !window.matchMedia(reducedMotionQuery).matches;
}

export function animateMotion(
	element: Element,
	frames: Keyframe[],
	options: KeyframeAnimationOptions,
) {
	if (!motionAllowed() || !element.animate) {
		return;
	}
	const animation = element.animate(frames, options);
	const preference = window.matchMedia(reducedMotionQuery);
	const stop = () => animation.cancel();
	preference.addEventListener("change", stop);
	const release = () => preference.removeEventListener("change", stop);
	void animation.finished.then(release, release);
	return animation;
}
