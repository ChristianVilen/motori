export const EVENTS = {
	vehicle: {
		created: "vehicle.created",
		updated: "vehicle.updated",
		deleted: "vehicle.deleted",
	},
	service_record: {
		created: "service_record.created",
	},
	reminder: {
		created: "reminder.created",
		updated: "reminder.updated",
		deleted: "reminder.deleted",
		completed: "reminder.completed",
	},
	odometer: {
		updated: "odometer.updated",
	},
	digest: {
		sent: "digest.sent",
		send_failed: "digest.send_failed",
	},
	image: {
		uploaded: "image.uploaded",
		upload_failed: "image.upload_failed",
	},
	// Mirrored as inlined literals in packages/server/src/email.ts — keep in sync.
	email: {
		sent: "email.sent",
		failed: "email.failed",
	},
} as const;

export type EventName =
	| (typeof EVENTS.vehicle)[keyof typeof EVENTS.vehicle]
	| (typeof EVENTS.service_record)[keyof typeof EVENTS.service_record]
	| (typeof EVENTS.reminder)[keyof typeof EVENTS.reminder]
	| (typeof EVENTS.odometer)[keyof typeof EVENTS.odometer]
	| (typeof EVENTS.digest)[keyof typeof EVENTS.digest]
	| (typeof EVENTS.image)[keyof typeof EVENTS.image]
	| (typeof EVENTS.email)[keyof typeof EVENTS.email];
