import { SITE_URL } from "~/lib/constants";
import { sendEmail } from "~/lib/email";
import { wrapEmail } from "~/lib/email-wrapper";
import { getEmailT } from "~/lib/i18n/email";

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) =>
		c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
	);
}

export async function sendNewMessageEmail(args: {
	to: string;
	listingTitle: string;
	conversationId: string;
	previewBody: string;
	language?: "fi" | "en";
}): Promise<void> {
	const lang = args.language ?? "fi";
	const t = getEmailT(lang);
	const url = `${SITE_URL}/viestit/${args.conversationId}`;
	const safeTitle = escapeHtml(args.listingTitle);
	const safePreview = escapeHtml(args.previewBody.slice(0, 300));

	await sendEmail({
		to: args.to,
		subject: t("newMessage.subject", { title: args.listingTitle }),
		html: wrapEmail(
			`
			<p>${t("newMessage.intro", { title: safeTitle })}</p>
			<blockquote style="border-left:3px solid #ccc;padding-left:12px;margin:12px 0;white-space:pre-wrap">${safePreview}</blockquote>
			<p>${t("newMessage.cta")}<br><a href="${url}">${url}</a></p>
		`,
			lang,
		),
		text: `${t("newMessage.intro", { title: args.listingTitle })}\n\n${url}`,
		idempotencyKey: `new-message/${args.conversationId}/${Date.now()}`,
	});
}
