/** Pure helpers — safe for client and server bundles. */
import { createServerFn } from "@tanstack/react-start";
import { csrfMiddleware } from "~/lib/csrf";
import { AppError } from "~/lib/errors";
import {
	blockUserServer,
	getConversationServer,
	listConversationsServer,
	listMessagesServer,
	markReadServer,
	sendMessageServer,
	startConversationServer,
	unblockUserServer,
} from "~/lib/messages.server";
import { getSession } from "~/lib/session";

export const MESSAGE_MAX_LENGTH = 4000;

export function validateMessageBody(input: string): string {
	const trimmed = input.trim();
	if (trimmed.length === 0) {
		throw new AppError("messages.body_empty");
	}
	if (trimmed.length > MESSAGE_MAX_LENGTH) {
		throw new AppError("messages.body_too_long");
	}
	return trimmed;
}

export function shouldNotifyByEmail(args: {
	recipientLastReadAt: Date | null;
	priorMessageCreatedAt: Date | null;
}): boolean {
	if (args.priorMessageCreatedAt === null) {
		return true;
	}
	if (args.recipientLastReadAt === null) {
		return false;
	}
	return args.recipientLastReadAt.getTime() >= args.priorMessageCreatedAt.getTime();
}

export interface ConversationListRow {
	id: string;
	listingId: string;
	listingTitle: string;
	listingThumbnailUrl: string | null;
	otherPartyId: string;
	otherPartyDisplayName: string;
	lastMessageAt: string; // ISO
	lastMessagePreview: string;
	unreadCount: number;
}

async function requireUserId(): Promise<string> {
	const session = await getSession();
	if (!session) {
		throw new Error("Ei istuntoa");
	}
	return session.user.id;
}

export const startConversation = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware()])
	.inputValidator((d: { listingId: string }) => d)
	.handler(async ({ data }) =>
		startConversationServer({ listingId: data.listingId, userId: await requireUserId() }),
	);

export const listConversations = createServerFn({ method: "GET" }).handler(async () =>
	listConversationsServer({ userId: await requireUserId() }),
);

export const getUnreadTotal = createServerFn({ method: "GET" }).handler(async () => {
	const session = await getSession();
	if (!session) {
		return { unread: 0 };
	}
	const rows = await listConversationsServer({ userId: session.user.id });
	return { unread: rows.reduce((n, c) => n + c.unreadCount, 0) };
});

export const getConversation = createServerFn({ method: "GET" })
	.inputValidator((d: { conversationId: string }) => d)
	.handler(async ({ data }) =>
		getConversationServer({ conversationId: data.conversationId, userId: await requireUserId() }),
	);

export const listMessages = createServerFn({ method: "GET" })
	.inputValidator((d: { conversationId: string; beforeCursor?: string }) => d)
	.handler(async ({ data }) =>
		listMessagesServer({ ...data, userId: await requireUserId() }),
	);

export const sendMessage = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware()])
	.inputValidator((d: { conversationId: string; body: string }) => d)
	.handler(async ({ data }) =>
		sendMessageServer({ ...data, userId: await requireUserId() }),
	);

export const markRead = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware()])
	.inputValidator((d: { conversationId: string }) => d)
	.handler(async ({ data }) => {
		await markReadServer({ conversationId: data.conversationId, userId: await requireUserId() });
	});

export const blockUser = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware()])
	.inputValidator((d: { targetUserId: string }) => d)
	.handler(async ({ data }) => {
		await blockUserServer({ userId: await requireUserId(), targetUserId: data.targetUserId });
	});

export const unblockUser = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware()])
	.inputValidator((d: { targetUserId: string }) => d)
	.handler(async ({ data }) => {
		await unblockUserServer({ userId: await requireUserId(), targetUserId: data.targetUserId });
	});
