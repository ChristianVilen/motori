export const EVENTS = {
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
} as const;

export type EventName =
	| (typeof EVENTS.auth)[keyof typeof EVENTS.auth]
	| (typeof EVENTS.listing)[keyof typeof EVENTS.listing]
	| (typeof EVENTS.image)[keyof typeof EVENTS.image]
	| (typeof EVENTS.email)[keyof typeof EVENTS.email];
