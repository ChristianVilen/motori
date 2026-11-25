import type { AnyRouter } from "@tanstack/react-router";
import { motionAllowed } from "./motion";

declare module "@tanstack/react-router" {
	interface HistoryState {
		listingPhoto?: { id: string; sourceKey: string };
	}
}

export function photoStyle(shortId: string) {
	return { viewTransitionName: `var(--listing-photo-${shortId}, none)` };
}

export function installPhotoTransitions(router: AnyRouter) {
	let active: string | undefined;
	router.subscribe("onBeforeNavigate", ({ fromLocation, toLocation, pathChanged }) => {
		const forward = toLocation.state.listingPhoto;
		const back = fromLocation?.state.listingPhoto;
		let id: string | undefined;
		if (pathChanged && motionAllowed() && typeof document.startViewTransition === "function") {
			if (forward && forward.sourceKey === fromLocation?.state.__TSR_key) {
				id = forward.id;
			} else if (back && back.sourceKey === toLocation.state.__TSR_key) {
				id = back.id;
			}
		}
		if (active) {
			document.documentElement.style.removeProperty(`--listing-photo-${active}`);
		}
		active = id;
		if (id) {
			document.documentElement.style.setProperty(`--listing-photo-${id}`, "listing-photo");
		}
		router.update({ defaultViewTransition: !!id });
	});
}
