/** Pure review helpers — safe for client and server bundles. */

import type { BookingStatus } from "~/lib/db/schema";

const REVIEW_WINDOW_DAYS = 14;

/** Review is eligible when booking is confirmed and end_date has passed. */
export function isReviewEligible(status: BookingStatus, endDate: string): boolean {
	if (status !== "confirmed") {
		return false;
	}
	const today = new Date().toISOString().slice(0, 10);
	return endDate < today;
}

/** Review window is open if within 14 days after end_date. */
export function isReviewWindowOpen(endDate: string): boolean {
	const deadline = new Date(`${endDate}T00:00:00Z`);
	deadline.setUTCDate(deadline.getUTCDate() + REVIEW_WINDOW_DAYS);
	const now = new Date();
	return now <= deadline;
}

/** A review is revealed when both parties submitted OR the 14-day deadline passed. */
export function isReviewRevealed(bothSubmitted: boolean, endDate: string): boolean {
	if (bothSubmitted) {
		return true;
	}
	const deadline = new Date(`${endDate}T00:00:00Z`);
	deadline.setUTCDate(deadline.getUTCDate() + REVIEW_WINDOW_DAYS);
	return new Date() > deadline;
}
