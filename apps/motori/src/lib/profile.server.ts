/**
 * Profile module — server only.
 * Owns all reads and writes of the `profile` table (ADR-0001 style: POJOs out,
 * intent-based reads, explicit side effects). Routes stay thin wrappers.
 */
import { sql } from "kysely";
import { db } from "~/lib/db/index";
import type { Profile } from "~/lib/db/schema";
import { getOwnerActiveListings } from "~/lib/listings-owner";
import { computeReviewSummary, getReviewsForUser } from "~/lib/reviews.server";

export type ProfileEditView = Pick<Profile, "display_name" | "city" | "phone" | "show_phone">;

export async function getProfileForEdit(userId: string): Promise<ProfileEditView | null> {
	const profile = await db
		.selectFrom("profile")
		.select(["display_name", "city", "phone", "show_phone"])
		.where("user_id", "=", userId)
		.executeTakeFirst();
	return profile ?? null;
}

/** Public view: safe columns only — never leaks phone or terms_accepted_at. */
export async function getPublicProfile(userId: string) {
	const profile = await db
		.selectFrom("profile")
		.select(["user_id", "display_name", "city", "created_at"])
		.where("user_id", "=", userId)
		.executeTakeFirst();

	if (!profile) {
		return null;
	}

	const [{ listings, images }, reviews] = await Promise.all([
		getOwnerActiveListings(userId),
		getReviewsForUser(userId),
	]);

	return { profile, listings, images, reviews, reviewSummary: computeReviewSummary(reviews) };
}

/**
 * First-login completion flow. Stamps terms_accepted_at — also on an existing
 * row where it is still null (the row may have been created via settings,
 * which never touches terms) — but never overwrites the original timestamp.
 */
export async function completeProfile(
	userId: string,
	input: { displayName: string; city: string; phone: string },
): Promise<void> {
	await db
		.insertInto("profile")
		.values({
			user_id: userId,
			display_name: input.displayName,
			city: input.city || null,
			phone: input.phone || null,
			language: "fi",
			terms_accepted_at: new Date(),
		})
		.onConflict((oc) =>
			oc.column("user_id").doUpdateSet({
				display_name: input.displayName,
				city: input.city || null,
				phone: input.phone || null,
				terms_accepted_at: sql<Date>`coalesce(profile.terms_accepted_at, now())`,
				updated_at: new Date(),
			}),
		)
		.execute();
}

/** Settings save. Never touches terms_accepted_at. */
export async function updateSettings(
	userId: string,
	input: { displayName: string; city: string; phone: string; showPhone: boolean },
): Promise<void> {
	await db
		.insertInto("profile")
		.values({
			user_id: userId,
			display_name: input.displayName,
			city: input.city || null,
			phone: input.phone || null,
			show_phone: input.showPhone,
			language: "fi",
		})
		.onConflict((oc) =>
			oc.column("user_id").doUpdateSet({
				display_name: input.displayName,
				city: input.city || null,
				phone: input.phone || null,
				show_phone: input.showPhone,
				updated_at: new Date(),
			}),
		)
		.execute();
}
