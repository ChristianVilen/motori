import { db } from "~/lib/db/index";
import { AppError } from "~/lib/errors";
import { log } from "~/lib/log";

const STATUSES_BLOCKED_FOR_NEW_CONVERSATION = new Set(["removed"]);

export async function startConversationServer(args: {
	listingId: string;
	userId: string;
}): Promise<{ conversationId: string }> {
	const listing = await db
		.selectFrom("listing")
		.select(["id", "owner_id", "status"])
		.where("id", "=", args.listingId)
		.executeTakeFirst();

	if (!listing) {
		throw new AppError("messages.listing_not_found");
	}
	if (listing.owner_id === args.userId) {
		throw new AppError("messages.own_listing");
	}
	if (STATUSES_BLOCKED_FOR_NEW_CONVERSATION.has(listing.status)) {
		throw new AppError("messages.listing_unavailable");
	}

	const block = await db
		.selectFrom("user_block")
		.select("blocker_id")
		.where((eb) =>
			eb.or([
				eb.and([
					eb("blocker_id", "=", listing.owner_id),
					eb("blocked_id", "=", args.userId),
				]),
				eb.and([
					eb("blocker_id", "=", args.userId),
					eb("blocked_id", "=", listing.owner_id),
				]),
			]),
		)
		.executeTakeFirst();
	if (block) {
		throw new AppError("messages.blocked");
	}

	const existing = await db
		.selectFrom("conversation")
		.select("id")
		.where("listing_id", "=", listing.id)
		.where("buyer_id", "=", args.userId)
		.executeTakeFirst();

	if (existing) {
		return { conversationId: existing.id };
	}

	const inserted = await db
		.insertInto("conversation")
		.values({
			listing_id: listing.id,
			buyer_id: args.userId,
			seller_id: listing.owner_id,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	log.info("messages.conversation_created", {
		event: "messages.conversation_created",
		conversationId: inserted.id,
		listingId: listing.id,
	});

	return { conversationId: inserted.id };
}
