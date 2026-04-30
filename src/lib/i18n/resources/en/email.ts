export default {
	verification: {
		subject: "Verify your email — Motori",
		greeting: "Hi,",
		body: "Verify your email address by clicking the link below:",
		expiry: "This link expires in 24 hours.",
	},
	listingExpiry: {
		subject: "Your listing expires soon — Motori",
		greeting: "Hi {{name}},",
		body: 'Your listing "{{title}}" expires in {{days}} days.',
		cta: "You can renew it by signing in.",
	},
	passwordReset: {
		subject: "Reset your password — Motori",
		greeting: "Hi,",
		body: "Reset your password by clicking the link below:",
		expiry: "This link expires in one hour.",
	},
	signature: "— Motori",
} as const;
