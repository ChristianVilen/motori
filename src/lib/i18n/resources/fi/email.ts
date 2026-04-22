export default {
	verification: {
		subject: "Vahvista sähköpostiosoitteesi — Vuokramoto",
		greeting: "Hei,",
		body: "Vahvista sähköpostiosoitteesi klikkaamalla alla olevaa linkkiä:",
		expiry: "Linkki vanhenee 24 tunnissa.",
	},
	listingExpiry: {
		subject: "Ilmoituksesi vanhenee pian — Vuokramoto",
		greeting: "Hei {{name}},",
		body: 'Ilmoituksesi "{{title}}" vanhenee {{days}} päivän kuluttua.',
		cta: "Voit uusia ilmoituksen kirjautumalla sisään.",
	},
	signature: "— Vuokramoto",
} as const;
