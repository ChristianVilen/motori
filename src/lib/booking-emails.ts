import { SITE_URL } from "~/lib/constants";
import { sendEmail } from "~/lib/email";
import { emailT as t } from "~/lib/i18n/email";

interface PartyInfo {
	display_name: string;
	email: string;
	phone: string | null;
}

interface BookingSummary {
	short_id: string;
	listing_title: string;
	start_date: string;
	end_date: string;
}

function dayCount(start: string, end: string): number {
	const a = new Date(`${start}T00:00:00Z`);
	const b = new Date(`${end}T00:00:00Z`);
	return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

function bookingUrl(shortId: string): string {
	return `${SITE_URL}/omat/varaukset/${shortId}`;
}

export async function sendBookingRequestEmail(args: {
	booking: BookingSummary;
	owner: PartyInfo;
	renter: PartyInfo;
	message: string;
}): Promise<void> {
	const { booking, owner, renter, message } = args;
	const url = bookingUrl(booking.short_id);
	const days = dayCount(booking.start_date, booking.end_date);

	await sendEmail({
		to: owner.email,
		subject: t("bookingRequest.subject", { title: booking.listing_title }),
		html: `
			<p>${t("bookingRequest.greeting", { name: owner.display_name })}</p>
			<p>${t("bookingRequest.intro", { title: booking.listing_title })}</p>
			<p>${t("bookingRequest.dates", { start: booking.start_date, end: booking.end_date, days })}</p>
			<p>${t("bookingRequest.renter", { name: renter.display_name, email: renter.email })}</p>
			<p><strong>${t("bookingRequest.message")}</strong><br>${escapeHtml(message)}</p>
			<p>${t("bookingRequest.cta")}<br><a href="${url}">${url}</a></p>
			<p>${t("signature")}</p>
		`,
		text: `${t("bookingRequest.intro", { title: booking.listing_title })}\n\n${t("bookingRequest.dates", { start: booking.start_date, end: booking.end_date, days })}\n\n${url}`,
		idempotencyKey: `booking-request/${booking.short_id}`,
	});
}

export async function sendBookingConfirmedEmail(args: {
	booking: BookingSummary;
	renter: PartyInfo;
	owner: PartyInfo;
}): Promise<void> {
	const { booking, renter, owner } = args;
	const phoneLine = owner.phone ? `<br>${owner.phone}` : "";
	await sendEmail({
		to: renter.email,
		subject: t("bookingConfirmed.subject", { title: booking.listing_title }),
		html: `
			<p>${t("bookingConfirmed.greeting", { name: renter.display_name })}</p>
			<p>${t("bookingConfirmed.body", { title: booking.listing_title, start: booking.start_date, end: booking.end_date })}</p>
			<p><strong>${t("bookingConfirmed.ownerContact")}</strong><br>${escapeHtml(owner.display_name)}<br>${owner.email}${phoneLine}</p>
			<p>${t("bookingConfirmed.nextSteps")}</p>
			<p>${t("signature")}</p>
		`,
		text: `${t("bookingConfirmed.body", { title: booking.listing_title, start: booking.start_date, end: booking.end_date })}\n\n${owner.display_name} <${owner.email}>${owner.phone ? ` ${owner.phone}` : ""}`,
		idempotencyKey: `booking-confirmed/${booking.short_id}`,
	});
}

export async function sendBookingRejectedEmail(args: {
	booking: BookingSummary;
	renter: PartyInfo;
	reason: string | null;
}): Promise<void> {
	const { booking, renter, reason } = args;
	const reasonBlock = reason
		? `<p><strong>${t("bookingRejected.reasonLabel")}</strong><br>${escapeHtml(reason)}</p>`
		: "";
	await sendEmail({
		to: renter.email,
		subject: t("bookingRejected.subject", { title: booking.listing_title }),
		html: `
			<p>${t("bookingRejected.greeting", { name: renter.display_name })}</p>
			<p>${t("bookingRejected.body", { title: booking.listing_title, start: booking.start_date, end: booking.end_date })}</p>
			${reasonBlock}
			<p>${t("bookingRejected.fallback")}</p>
			<p>${t("signature")}</p>
		`,
		idempotencyKey: `booking-rejected/${booking.short_id}`,
	});
}

export async function sendBookingAutoRejectedEmail(args: {
	booking: BookingSummary;
	renter: PartyInfo;
}): Promise<void> {
	const { booking, renter } = args;
	await sendEmail({
		to: renter.email,
		subject: t("bookingAutoRejected.subject", { title: booking.listing_title }),
		html: `
			<p>${t("bookingAutoRejected.greeting", { name: renter.display_name })}</p>
			<p>${t("bookingAutoRejected.body", { start: booking.start_date, end: booking.end_date })}</p>
			<p>${t("bookingAutoRejected.fallback")}</p>
			<p>${t("signature")}</p>
		`,
		idempotencyKey: `booking-auto-rejected/${booking.short_id}`,
	});
}

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) =>
		c === "&"
			? "&amp;"
			: c === "<"
				? "&lt;"
				: c === ">"
					? "&gt;"
					: c === '"'
						? "&quot;"
						: "&#39;",
	);
}
