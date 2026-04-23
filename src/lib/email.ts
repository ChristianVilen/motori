import { Resend } from "resend";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";

export interface EmailPayload {
	to: string;
	subject: string;
	html: string;
	text?: string;
	idempotencyKey?: string;
}

const FROM = "Vuokramoto <noreply@vuokramoto.fi>";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function hashRecipient(to: string): string {
	const [local, domain] = to.split("@");
	if (!local || !domain) {
		return "***";
	}
	return `${local.slice(0, 1)}***@${domain}`;
}

function logMockEmail(payload: EmailPayload): void {
	const urls = [...payload.html.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) => m[0]);
	const lines = [
		"┌─── 📧 MOCK EMAIL ───────────────────────────",
		`│ To:      ${payload.to}`,
		`│ Subject: ${payload.subject}`,
		...(urls.length ? [`│ URLs:    ${urls.join("\n│          ")}`] : []),
		...(payload.text
			? [`│ Preview: ${payload.text.split("\n").slice(0, 3).join("\n│          ")}`]
			: []),
		"└──────────────────────────────────────────────",
	];
	log.info(lines.join("\n"));
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
	const toHash = hashRecipient(payload.to);

	if (resend) {
		const { data, error } = await resend.emails.send({
			from: FROM,
			to: payload.to,
			subject: payload.subject,
			html: payload.html,
			text: payload.text,
			...(payload.idempotencyKey && { idempotencyKey: payload.idempotencyKey }),
		});

		if (error) {
			log.event(EVENTS.email.failed, { template: payload.subject, reason: error.message });
			throw new Error(error.message);
		}

		log.event(EVENTS.email.sent, { template: payload.subject, toHash, resendId: data?.id });
		return;
	}

	logMockEmail(payload);
	log.event(EVENTS.email.sent, { template: payload.subject, toHash, provider: "mock" });
}
