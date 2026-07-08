import { checkRateLimit } from "@motori/server/rate-limit";
import { sql } from "kysely";
import { db } from "~/lib/db/index";
import type { Message, MessageKind } from "~/lib/db/schema";
import { sendNewMessageEmail } from "~/lib/email-templates/new-message";
import { AppError } from "~/lib/errors";
import { log } from "~/lib/log";
import type { ConversationListRow } from "~/lib/messages";
import { shouldNotifyByEmail, validateMessageBody } from "~/lib/messages";
import { publish } from "~/lib/messages-bus";

const STATUSES_BLOCKED_FOR_NEW_CONVERSATION = new Set(["removed"]);
const STATUSES_READONLY = new Set(["removed"]);

export async function startConversationServer(args: {
	listingId: string;
	userId: string;
}): Promise<{ conversationId: string }> {
	const rl = checkRateLimit(`msg:new:${args.userId}`, 10, 60 * 60 * 1000);
	if (!rl.allowed) {
		throw new AppError("messages.rate_limited");
	}

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
				eb.and([eb("blocker_id", "=", listing.owner_id), eb("blocked_id", "=", args.userId)]),
				eb.and([eb("blocker_id", "=", args.userId), eb("blocked_id", "=", listing.owner_id)]),
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

	// INSERT ... ON CONFLICT DO NOTHING avoids a race when two concurrent
	// requests try to create the same conversation.
	const inserted = await db
		.insertInto("conversation")
		.values({
			listing_id: listing.id,
			buyer_id: args.userId,
			seller_id: listing.owner_id,
		})
		.onConflict((oc) => oc.columns(["listing_id", "buyer_id"]).doNothing())
		.returning("id")
		.executeTakeFirst();

	if (!inserted) {
		// Lost the race — another request created it. Re-fetch.
		const winner = await db
			.selectFrom("conversation")
			.select("id")
			.where("listing_id", "=", listing.id)
			.where("buyer_id", "=", args.userId)
			.executeTakeFirstOrThrow();
		return { conversationId: winner.id };
	}

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
	const rlSend = checkRateLimit(`msg:send:${args.userId}`, 30, 60 * 1000);
	if (!rlSend.allowed) {
		throw new AppError("messages.rate_limited");
	}

	const trimmedBody = validateMessageBody(args.body);

	const conv = await db
		.selectFrom("conversation")
		.innerJoin("listing", "listing.id", "conversation.listing_id")
		.innerJoin("user as buyer_user", "buyer_user.id", "conversation.buyer_id")
		.innerJoin("user as seller_user", "seller_user.id", "conversation.seller_id")
		.innerJoin("profile as buyer_profile", "buyer_profile.user_id", "conversation.buyer_id")
		.innerJoin("profile as seller_profile", "seller_profile.user_id", "conversation.seller_id")
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
			"buyer_profile.language as buyer_language",
			"seller_profile.language as seller_language",
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
	if (block) {
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
	const recipientLastReadAt = recipientIsBuyer ? conv.buyer_last_read_at : conv.seller_last_read_at;
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
			messageId: inserted.id,
			previewBody: trimmedBody,
			language: (recipientIsBuyer ? conv.buyer_language : conv.seller_language) as "fi" | "en",
		}).catch((err) =>
			log.error("messages.email_failed", {
				error: String(err),
				conversationId: conv.id,
			}),
		);
	}

	return { messageId: inserted.id };
}

export async function listConversationsServer(args: {
	userId: string;
}): Promise<ConversationListRow[]> {
	const rows = await db
		.selectFrom("conversation")
		.innerJoin("listing", "listing.id", "conversation.listing_id")
		.leftJoin("listing_image", (j) =>
			j.onRef("listing_image.listing_id", "=", "listing.id").on("listing_image.order", "=", 0),
		)
		.innerJoin("profile as buyer_profile", "buyer_profile.user_id", "conversation.buyer_id")
		.innerJoin("profile as seller_profile", "seller_profile.user_id", "conversation.seller_id")
		.select((eb) => [
			"conversation.id",
			"conversation.listing_id",
			"conversation.buyer_id",
			"conversation.seller_id",
			"conversation.last_message_at",
			"conversation.buyer_last_read_at",
			"conversation.seller_last_read_at",
			"listing.title as listing_title",
			"listing_image.thumbnail_url as listing_thumbnail_url",
			"buyer_profile.display_name as buyer_name",
			"seller_profile.display_name as seller_name",
			eb
				.selectFrom("message")
				.select("body")
				.whereRef("conversation_id", "=", "conversation.id")
				.orderBy("created_at", "desc")
				.limit(1)
				.as("last_body"),
			sql<string>`(
				SELECT count(*)
				FROM message
				WHERE message.conversation_id = conversation.id
				  AND message.sender_id <> ${sql.val(args.userId)}
				  AND (
				    CASE
				      WHEN conversation.buyer_id = ${sql.val(args.userId)}
				        THEN (conversation.buyer_last_read_at IS NULL OR message.created_at > conversation.buyer_last_read_at)
				      ELSE (conversation.seller_last_read_at IS NULL OR message.created_at > conversation.seller_last_read_at)
				    END
				  )
			)`.as("unread_count"),
		])
		.where((eb) =>
			eb.or([
				eb("conversation.buyer_id", "=", args.userId),
				eb("conversation.seller_id", "=", args.userId),
			]),
		)
		.orderBy("conversation.last_message_at", "desc")
		.execute();

	return rows.map((r) => {
		const isBuyer = r.buyer_id === args.userId;
		return {
			id: r.id,
			listingId: r.listing_id,
			listingTitle: r.listing_title,
			listingThumbnailUrl: r.listing_thumbnail_url,
			otherPartyId: isBuyer ? r.seller_id : r.buyer_id,
			otherPartyDisplayName: isBuyer ? r.seller_name : r.buyer_name,
			lastMessageAt: r.last_message_at.toISOString(),
			lastMessagePreview: (r.last_body ?? "").slice(0, 140),
			unreadCount: Number(r.unread_count ?? 0),
		};
	});
}

export interface ConversationDetail {
	id: string;
	listing: { id: string; title: string; status: string; ownerId: string };
	otherParty: { id: string; displayName: string };
	role: "buyer" | "seller";
	readOnly: boolean;
}

export async function getConversationServer(args: {
	conversationId: string;
	userId: string;
}): Promise<ConversationDetail> {
	const row = await db
		.selectFrom("conversation")
		.innerJoin("listing", "listing.id", "conversation.listing_id")
		.innerJoin("profile as buyer_profile", "buyer_profile.user_id", "conversation.buyer_id")
		.innerJoin("profile as seller_profile", "seller_profile.user_id", "conversation.seller_id")
		.select([
			"conversation.id",
			"conversation.buyer_id",
			"conversation.seller_id",
			"listing.id as listing_id",
			"listing.title as listing_title",
			"listing.status as listing_status",
			"listing.owner_id as listing_owner_id",
			"buyer_profile.display_name as buyer_name",
			"seller_profile.display_name as seller_name",
		])
		.where("conversation.id", "=", args.conversationId)
		.executeTakeFirst();
	if (!row) {
		throw new AppError("messages.conversation_not_found");
	}
	if (row.buyer_id !== args.userId && row.seller_id !== args.userId) {
		throw new AppError("messages.forbidden");
	}
	const role = row.buyer_id === args.userId ? "buyer" : "seller";
	return {
		id: row.id,
		listing: {
			id: row.listing_id,
			title: row.listing_title,
			status: row.listing_status,
			ownerId: row.listing_owner_id,
		},
		otherParty: {
			id: role === "buyer" ? row.seller_id : row.buyer_id,
			displayName: role === "buyer" ? row.seller_name : row.buyer_name,
		},
		role,
		readOnly: row.listing_status === "removed",
	};
}

export async function listMessagesServer(args: {
	conversationId: string;
	userId: string;
	beforeCursor?: string;
	limit?: number;
}): Promise<{ messages: Message[]; hasMore: boolean }> {
	const detail = await getConversationServer({
		conversationId: args.conversationId,
		userId: args.userId,
	});
	const limit = args.limit ?? 50;
	let q = db
		.selectFrom("message")
		.selectAll()
		.where("conversation_id", "=", detail.id)
		.orderBy("created_at", "desc")
		.limit(limit + 1);
	if (args.beforeCursor) {
		q = q.where("created_at", "<", new Date(args.beforeCursor));
	}
	const rows = await q.execute();
	const hasMore = rows.length > limit;
	const page = (hasMore ? rows.slice(0, limit) : rows).reverse();
	return { messages: page as Message[], hasMore };
}

export async function blockUserServer(args: {
	userId: string;
	targetUserId: string;
}): Promise<void> {
	if (args.userId === args.targetUserId) {
		throw new AppError("messages.cannot_block_self");
	}
	await db
		.insertInto("user_block")
		.values({ blocker_id: args.userId, blocked_id: args.targetUserId })
		.onConflict((oc) => oc.columns(["blocker_id", "blocked_id"]).doNothing())
		.execute();
}

export async function unblockUserServer(args: {
	userId: string;
	targetUserId: string;
}): Promise<void> {
	await db
		.deleteFrom("user_block")
		.where("blocker_id", "=", args.userId)
		.where("blocked_id", "=", args.targetUserId)
		.execute();
}

export async function markReadServer(args: {
	conversationId: string;
	userId: string;
}): Promise<void> {
	const detail = await getConversationServer({
		conversationId: args.conversationId,
		userId: args.userId,
	});
	const column = detail.role === "buyer" ? "buyer_last_read_at" : "seller_last_read_at";
	await db
		.updateTable("conversation")
		.set({ [column]: new Date() } as never)
		.where("id", "=", detail.id)
		.execute();
}
