import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";

export interface EmailPayload {
	to: string;
	subject: string;
	html: string;
	text?: string;
}

function hashRecipient(to: string): string {
	// Truncate local part: `alice@example.com` -> `a***@example.com`.
	const [local, domain] = to.split("@");
	if (!local || !domain) {
		return "***";
	}
	return `${local.slice(0, 1)}***@${domain}`;
}

function logMockEmail(payload: EmailPayload): void {
	const urls = [...payload.html.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) => m[0]);

	log.info("mock email", {
		toHash: hashRecipient(payload.to),
		subject: payload.subject,
		urls,
		textPreview: payload.text?.split("\n").slice(0, 6).join("\n"),
	});
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
	// Drop-in Resend: uncomment when RESEND_API_KEY is set
	// if (process.env.RESEND_API_KEY) {
	//   const { Resend } = await import("resend");
	//   const resend = new Resend(process.env.RESEND_API_KEY);
	//   try {
	//     await resend.emails.send({
	//       from: "Vuokramoto <noreply@vuokramoto.fi>",
	//       to: payload.to,
	//       subject: payload.subject,
	//       html: payload.html,
	//       text: payload.text,
	//     });
	//     log.event(EVENTS.email.sent, { template: payload.subject, toHash: hashRecipient(payload.to) });
	//     return;
	//   } catch (err) {
	//     log.event(EVENTS.email.failed, { template: payload.subject, reason: (err as Error).message });
	//     throw err;
	//   }
	// }
	logMockEmail(payload);
	log.event(EVENTS.email.sent, {
		template: payload.subject,
		toHash: hashRecipient(payload.to),
		provider: "mock",
	});
}
