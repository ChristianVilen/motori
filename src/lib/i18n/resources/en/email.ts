export default {
	verification: {
		subject: "Verify your email — Motori",
		greeting: "Hi,",
		body: "Click the link below to verify your email address:",
		expiry: "This link expires in 24 hours.",
	},
	listingExpiry: {
		subject: "Your listing expires soon — Motori",
		greeting: "Hi {{name}},",
		body: 'Your listing "{{title}}" expires in {{days}} days.',
		cta: "Sign in to renew it.",
	},
	passwordReset: {
		subject: "Reset your password — Motori",
		greeting: "Hi,",
		body: "Click the link below to reset your password:",
		expiry: "This link expires in one hour.",
	},
	bookingRequest: {
		subject: "New booking request: {{title}}",
		greeting: "Hi {{name}},",
		intro: 'You have a new booking request for "{{title}}".',
		dates: "Dates: {{start}} – {{end}} ({{days}} days)",
		renter: "Renter: {{name}} ({{email}})",
		message: "Message from the renter:",
		cta: "View the booking and respond in your account:",
	},
	bookingConfirmed: {
		subject: "Booking confirmed: {{title}}",
		greeting: "Hi {{name}},",
		body: 'Your booking for "{{title}}" from {{start}} to {{end}} is confirmed.',
		ownerContact: "Owner contact details:",
		nextSteps: "Reach out to the owner directly to arrange the handover.",
	},
	bookingRejected: {
		subject: "Booking request declined: {{title}}",
		greeting: "Hi {{name}},",
		body: 'The owner declined your booking request for "{{title}}" from {{start}} to {{end}}.',
		reasonLabel: "Reason:",
		fallback: "You can search for another motorcycle on the site.",
	},
	bookingAutoRejected: {
		subject: "Booking request cancelled: {{title}}",
		greeting: "Hi {{name}},",
		body: "The dates {{start}} – {{end}} were booked by someone else.",
		fallback: "You can search for another date or listing on the site.",
	},
} as const;
