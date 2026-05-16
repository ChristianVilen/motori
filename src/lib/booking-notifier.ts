import {
	sendBookingAutoRejectedEmail,
	sendBookingConfirmedEmail,
	sendBookingRejectedEmail,
	sendBookingRequestEmail,
} from "~/lib/booking-emails";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { sendMessageServer, startConversationServer } from "~/lib/messages.server";

export interface PartyInfo {
	display_name: string;
	email: string;
	phone: string | null;
	language: "fi" | "en";
}

export interface BookingSummary {
	short_id: string;
	listing_title: string;
	start_date: string;
	end_date: string;
}

export interface BookingNotifier {
	startConversation(args: {
		listingId: string;
		userId: string;
	}): Promise<{ conversationId: string }>;

	notifyBookingRequested(args: {
		booking: BookingSummary;
		owner: PartyInfo;
		renter: PartyInfo;
		message: string;
		conversationId: string;
		bookingId: string;
		senderUserId: string;
	}): Promise<void>;

	notifyBookingConfirmed(args: {
		booking: BookingSummary;
		renter: PartyInfo;
		owner: PartyInfo;
	}): Promise<void>;

	notifyBookingRejected(args: {
		booking: BookingSummary;
		renter: PartyInfo;
		reason: string | null;
	}): Promise<void>;

	notifyBookingAutoRejected(args: { booking: BookingSummary; renter: PartyInfo }): Promise<void>;
}

export const realNotifier: BookingNotifier = {
	async startConversation(args) {
		return startConversationServer(args);
	},

	async notifyBookingRequested(args) {
		sendMessageServer({
			conversationId: args.conversationId,
			userId: args.senderUserId,
			body: args.message,
			kind: "booking_request",
			bookingId: args.bookingId,
		}).catch((err) =>
			log.event(EVENTS.booking.system_message_failed, {
				err: String(err),
				bookingId: args.bookingId,
			}),
		);

		sendBookingRequestEmail({
			booking: args.booking,
			owner: args.owner,
			renter: args.renter,
			message: args.message,
		}).catch((err) => log.event(EVENTS.email.failed, { err }));
	},

	async notifyBookingConfirmed(args) {
		sendBookingConfirmedEmail(args).catch((err) => log.event(EVENTS.email.failed, { err }));
	},

	async notifyBookingRejected(args) {
		sendBookingRejectedEmail(args).catch((err) => log.event(EVENTS.email.failed, { err }));
	},

	async notifyBookingAutoRejected(args) {
		sendBookingAutoRejectedEmail(args).catch((err) => log.event(EVENTS.email.failed, { err }));
	},
};

export type RecordedNotification =
	| { kind: "startConversation"; args: { listingId: string; userId: string } }
	| {
			kind: "bookingRequested";
			args: Parameters<BookingNotifier["notifyBookingRequested"]>[0];
	  }
	| {
			kind: "bookingConfirmed";
			args: Parameters<BookingNotifier["notifyBookingConfirmed"]>[0];
	  }
	| {
			kind: "bookingRejected";
			args: Parameters<BookingNotifier["notifyBookingRejected"]>[0];
	  }
	| {
			kind: "bookingAutoRejected";
			args: Parameters<BookingNotifier["notifyBookingAutoRejected"]>[0];
	  };

export function createInMemoryNotifier(
	conversationId = "conv-stub",
): BookingNotifier & { calls: RecordedNotification[] } {
	const calls: RecordedNotification[] = [];
	return {
		calls,
		async startConversation(args) {
			calls.push({ kind: "startConversation", args });
			return { conversationId };
		},
		async notifyBookingRequested(args) {
			calls.push({ kind: "bookingRequested", args });
		},
		async notifyBookingConfirmed(args) {
			calls.push({ kind: "bookingConfirmed", args });
		},
		async notifyBookingRejected(args) {
			calls.push({ kind: "bookingRejected", args });
		},
		async notifyBookingAutoRejected(args) {
			calls.push({ kind: "bookingAutoRejected", args });
		},
	};
}
