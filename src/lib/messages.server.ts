import { db } from "~/lib/db/index";
import type { Message, MessageKind } from "~/lib/db/schema";
import { sendNewMessageEmail } from "~/lib/email-templates/new-message";
import { AppError } from "~/lib/errors";
import { log } from "~/lib/log";
import { shouldNotifyByEmail, validateMessageBody } from "~/lib/messages";
import { publish } from "~/lib/messages-bus";

const STATUSES_BLOCKED_FOR_NEW_CONVERSATION = new Set(["removed"]);
const STATUSES_READONLY = new Set(["removed"]);

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

export async function sendMessageServer(args: {
	conversationId: string;
	userId: string;
	body: string;
	kind?: MessageKind;
	bookingId?: string;
}): Promise<{ messageId: string }> {
	const trimmedBody = validateMessageBody(args.body);

	const conv = await db
		.selectFrom("conversation")
		.innerJoin("listing", "listing.id", "conversation.listing_id")
		.innerJoin("user as buyer_user", "buyer_user.id", "conversation.buyer_id")
		.innerJoin("user as seller_user", "seller_user.id", "conversation.seller_id")
		.select([
			"conversation.id",
			"conversation.buyer_id",
			"conversation.seller_id",
			"conversation.buyer_last_read_at",
			"conversation.seller_last_read_at",
			"listing.id as listing_id",
			"listing.title as listing_title",
			"listing.status as listing_status",
			"buyer_user.email as buyer_email",
			"buyer_user.emailVerified as buyer_email_verified",
			"seller_user.email as seller_email",
			"seller_user.emailVerified as seller_email_verified",
		])
		.where("conversation.id", "=", args.conversationId)
		.executeTakeFirst();

	if (!conv) {
		throw new AppError("messages.conversation_not_found");
	}
	if (conv.buyer_id !== args.userId && conv.seller_id !== args.userId) {
		throw new AppError("messages.forbidden");
	}
	if (STATUSES_READONLY.has(conv.listing_status)) {
		throw new AppError("messages.listing_readonly");
	}

	const block = await db
		.selectFrom("user_block")
		.select("blocker_id")
		.where((eb) =>
			eb.or([
				eb.and([eb("blocker_id", "=", conv.buyer_id), eb("blocked_id", "=", conv.seller_id)]),
				eb.and([eb("blocker_id", "=", conv.seller_id), eb("blocked_id", "=", conv.buyer_id)]),
			]),
		)
		.executeTakeFirst();
	if (block && block.blocker_id !== args.userId) {
		throw new AppError("messages.blocked");
	}

	const prior = await db
		.selectFrom("message")
		.select(["created_at"])
		.where("conversation_id", "=", conv.id)
		.orderBy("created_at", "desc")
		.limit(1)
		.executeTakeFirst();

	const inserted = await db.transaction().execute(async (trx) => {
		const m = await trx
			.insertInto("message")
			.values({
				conversation_id: conv.id,
				sender_id: args.userId,
				kind: args.kind ?? "text",
				body: trimmedBody,
				booking_id: args.bookingId ?? null,
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		await trx
			.updateTable("conversation")
			.set({ last_message_at: m.created_at })
			.where("id", "=", conv.id)
			.execute();

		return m;
	});

	publish(conv.id, inserted as Message);

	const recipientIsBuyer = conv.seller_id === args.userId;
	const recipientLastReadAt = recipientIsBuyer
		? conv.buyer_last_read_at
		: conv.seller_last_read_at;
	const recipientEmail = recipientIsBuyer ? conv.buyer_email : conv.seller_email;
	const recipientVerified = recipientIsBuyer
		? conv.buyer_email_verified
		: conv.seller_email_verified;

	if (
		recipientVerified &&
		shouldNotifyByEmail({
			recipientLastReadAt: recipientLastReadAt as Date | null,
			priorMessageCreatedAt: (prior?.created_at as Date | undefined) ?? null,
		})
	) {
		void sendNewMessageEmail({
			to: recipientEmail,
			listingTitle: conv.listing_title,
			conversationId: conv.id,
			previewBody: trimmedBody,
		}).catch((err) =>
			log.error("messages.email_failed", {
				error: String(err),
				conversationId: conv.id,
			}),
		);
	}

	return { messageId: inserted.id };
}
