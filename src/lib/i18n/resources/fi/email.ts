export default {
	verification: {
		subject: "Vahvista sähköpostiosoitteesi — Motori",
		greeting: "Hei,",
		body: "Vahvista sähköpostiosoitteesi klikkaamalla alla olevaa linkkiä:",
		expiry: "Linkki vanhenee 24 tunnissa.",
	},
	listingExpiry: {
		subject: "Ilmoituksesi vanhenee pian — Motori",
		greeting: "Hei {{name}},",
		body: 'Ilmoituksesi "{{title}}" vanhenee {{days}} päivän kuluttua.',
		cta: "Voit uusia ilmoituksen kirjautumalla sisään.",
	},
	passwordReset: {
		subject: "Vaihda salasanasi — Motori",
		greeting: "Hei,",
		body: "Vaihda salasanasi klikkaamalla alla olevaa linkkiä:",
		expiry: "Linkki vanhenee tunnin kuluttua.",
	},
	signature: "— Motori",
} as const;
