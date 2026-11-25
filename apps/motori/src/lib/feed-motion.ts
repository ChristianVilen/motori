import type { AnyRouter, ParsedLocation } from "@tanstack/react-router";
import { BROWSE_CATEGORIES } from "./constants";
import { animateMotion, motionAllowed, motionEase } from "./motion";

interface CardPosition {
	node: HTMLElement;
	rect: DOMRect;
	left: number;
	top: number;
}

function isList(location: ParsedLocation) {
	return (
		BROWSE_CATEGORIES.some((c) => c.to === location.pathname) &&
		new URLSearchParams(location.searchStr).get("view") !== "map"
	);
}

function measureCards() {
	const cards = new Map<string, CardPosition>();
	for (const node of document.querySelectorAll<HTMLElement>(
		"[data-feed-grid] > [data-listing-id]",
	)) {
		const id = node.dataset.listingId;
		if (!id) {
			continue;
		}
		const rect = node.getBoundingClientRect();
		cards.set(id, { node, rect, left: rect.left + scrollX, top: rect.top + scrollY });
	}
	return cards;
}

function visible(rect: DOMRect) {
	return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
}

export function installFeedMotion(router: AnyRouter) {
	let pending: { href: string; cards: ReturnType<typeof measureCards> } | undefined;
	const running = new Set<Animation>();
	function play(node: HTMLElement, frames: Keyframe[], done?: () => void) {
		const animation = animateMotion(node, frames, { duration: 250, easing: motionEase });
		if (!animation) {
			done?.();
			return;
		}
		running.add(animation);
		const finish = () => {
			running.delete(animation);
			done?.();
		};
		void animation.finished.then(finish, finish);
	}
	router.subscribe("onBeforeNavigate", ({ fromLocation, toLocation }) => {
		const changesFeed =
			fromLocation &&
			isList(fromLocation) &&
			isList(toLocation) &&
			fromLocation.href !== toLocation.href &&
			!new URLSearchParams(toLocation.searchStr).has("cursor");
		pending =
			changesFeed && motionAllowed() ? { href: toLocation.href, cards: measureCards() } : undefined;
		for (const animation of running) {
			animation.cancel();
		}
	});
	function moveCards(previous: Map<string, CardPosition>, next: Map<string, CardPosition>) {
		for (const [id, card] of next) {
			const old = previous.get(id);
			if (!visible(card.rect) && !(old && visible(old.rect))) {
				continue;
			}
			if (!old) {
				play(card.node, [{ opacity: 0 }, { opacity: 1 }]);
				continue;
			}
			const x = old.left - card.left;
			const y = old.top - card.top;
			if (x || y) {
				play(card.node, [{ transform: `translate(${x}px,${y}px)` }, { transform: "none" }]);
			}
		}
	}
	function fadeRemoved(old: CardPosition) {
		const ghost = old.node.cloneNode(true);
		if (!(ghost instanceof HTMLElement)) {
			return;
		}
		ghost.inert = true;
		ghost.setAttribute("aria-hidden", "true");
		ghost.removeAttribute("data-listing-id");
		for (const element of [ghost, ...ghost.querySelectorAll("[id],[data-testid]")]) {
			element.removeAttribute("data-testid");
			element.removeAttribute("id");
		}
		Object.assign(ghost.style, {
			position: "absolute",
			pointerEvents: "none",
			left: `${old.left}px`,
			top: `${old.top}px`,
			width: `${old.rect.width}px`,
			height: `${old.rect.height}px`,
		});
		document.body.append(ghost);
		play(ghost, [{ opacity: 1 }, { opacity: 0 }], () => ghost.remove());
	}
	router.subscribe("onRendered", ({ toLocation }) => {
		if (!pending || pending.href !== toLocation.href) {
			return;
		}
		const previous = pending.cards;
		pending = undefined;
		if (!motionAllowed()) {
			return;
		}
		const next = measureCards();
		moveCards(previous, next);

		for (const [id, old] of previous) {
			if (next.has(id) || !visible(old.rect)) {
				continue;
			}
			fadeRemoved(old);
		}
	});
}
