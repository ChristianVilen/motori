export const EVENTS = {
	account: {
		deleted: "account.deleted",
	},
	auth: {
		login_success: "auth.login.success",
		login_failure: "auth.login.failure",
		signup: "auth.signup",
		logout: "auth.logout",
	},
	listing: {
		created: "listing.created",
		updated: "listing.updated",
		deleted: "listing.deleted",
		contact_revealed: "listing.contact_revealed",
	},
	image: {
		uploaded: "image.uploaded",
		upload_failed: "image.upload_failed",
	},
	email: {
		sent: "email.sent",
		failed: "email.failed",
	},
	notification: {
		expiry_warning_sent: "notification.expiry_warning.sent",
		expiry_warning_skipped: "notification.expiry_warning.skipped",
	},
	booking: {
		requested: "booking.requested",
		confirmed: "booking.confirmed",
		rejected: "booking.rejected",
		cancelled: "booking.cancelled",
		expired: "booking.expired",
		auto_rejected_overlap: "booking.auto_rejected_overlap",
	},
	review: {
		submitted: "review.submitted",
	},
	tori: {
		created: "tori.created",
		updated: "tori.updated",
		status_changed: "tori.status_changed",
	},
} as const;

export type EventName =
	| (typeof EVENTS.account)[keyof typeof EVENTS.account]
	| (typeof EVENTS.auth)[keyof typeof EVENTS.auth]
	| (typeof EVENTS.listing)[keyof typeof EVENTS.listing]
	| (typeof EVENTS.image)[keyof typeof EVENTS.image]
	| (typeof EVENTS.email)[keyof typeof EVENTS.email]
	| (typeof EVENTS.notification)[keyof typeof EVENTS.notification]
	| (typeof EVENTS.booking)[keyof typeof EVENTS.booking]
	| (typeof EVENTS.review)[keyof typeof EVENTS.review]
	| (typeof EVENTS.tori)[keyof typeof EVENTS.tori];
