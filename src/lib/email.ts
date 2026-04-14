export interface EmailPayload {
	to: string;
	subject: string;
	html: string;
	text?: string;
}

function logMockEmail(payload: EmailPayload): void {
	const width = 62;
	const bar = "─".repeat(width);
	const pad = (s: string) => s.substring(0, width - 2).padEnd(width - 2);

	const urls = [...payload.html.matchAll(/https?:\/\/[^\s"'<>]+/g)].map(
		(m) => m[0],
	);

	console.log(`\n┌${bar}┐`);
	console.log(`│ ${pad("📧  MOCK EMAIL")} │`);
	console.log(`├${bar}┤`);
	console.log(`│ ${pad(`To:      ${payload.to}`)} │`);
	console.log(`│ ${pad(`Subject: ${payload.subject}`)} │`);

	if (urls.length > 0) {
		console.log(`├${bar}┤`);
		console.log(`│ ${pad("🔗  Links:")} │`);
		console.log(`├${bar}┤`);
		for (const url of urls) {
			console.log(url);
		}
	}

	if (payload.text) {
		console.log(`├${bar}┤`);
		for (const line of payload.text.split("\n").slice(0, 6)) {
			console.log(`│ ${pad(line)} │`);
		}
	}

	console.log(`└${bar}┘\n`);
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
	// Drop-in Resend: uncomment when RESEND_API_KEY is set
	// if (process.env.RESEND_API_KEY) {
	//   const { Resend } = await import("resend");
	//   const resend = new Resend(process.env.RESEND_API_KEY);
	//   await resend.emails.send({
	//     from: "Vuokramoto <noreply@vuokramoto.fi>",
	//     to: payload.to,
	//     subject: payload.subject,
	//     html: payload.html,
	//     text: payload.text,
	//   });
	//   return;
	// }
	logMockEmail(payload);
}
