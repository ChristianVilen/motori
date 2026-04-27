import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";

export interface EmailPayload {
	to: string;
	subject: string;
	html: string;
	text?: string;
	idempotencyKey?: string;
}

const FROM = "Motori <noreply@motori.fi>";

let _resend: import("resend").Resend | null | undefined;
async function getResend() {
	if (_resend === undefined) {
		if (process.env.RESEND_API_KEY) {
			const { Resend } = await import("resend");
			_resend = new Resend(process.env.RESEND_API_KEY);
		} else {
			_resend = null;
		}
	}
	return _resend;
}

function hashRecipient(to: string): string {
	const [local, domain] = to.split("@");
	if (!local || !domain) {
		return "***";
	}
	return `${local.slice(0, 1)}***@${domain}`;
}

function logMockEmail(payload: EmailPayload): void {
	// Full address logged intentionally in dev — mock path only runs when RESEND_API_KEY is absent.
	// Production sends use hashRecipient() via the Resend path above.
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

	const resend = await getResend();
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
