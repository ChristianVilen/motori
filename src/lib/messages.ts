/** Pure helpers — safe for client and server bundles. */
import { AppError } from "~/lib/errors";

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
