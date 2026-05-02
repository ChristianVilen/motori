import { SITE_URL } from "~/lib/constants";
import { sendEmail } from "~/lib/email";
import { wrapEmail } from "~/lib/email-wrapper";
import { getEmailT } from "~/lib/i18n/email";

interface PartyInfo {
	display_name: string;
	email: string;
	phone: string | null;
	language: "fi" | "en";
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
	const t = getEmailT(owner.language);
	const safeOwnerName = escapeHtml(owner.display_name);
	const safeTitle = escapeHtml(booking.listing_title);
	const safeRenterName = escapeHtml(renter.display_name);
	const safeRenterEmail = escapeHtml(renter.email);

	await sendEmail({
		to: owner.email,
		subject: t("bookingRequest.subject", { title: booking.listing_title }),
		html: wrapEmail(`
			<p>${t("bookingRequest.greeting", { name: safeOwnerName })}</p>
			<p>${t("bookingRequest.intro", { title: safeTitle })}</p>
			<p>${t("bookingRequest.dates", { start: booking.start_date, end: booking.end_date, days })}</p>
			<p>${t("bookingRequest.renter", { name: safeRenterName, email: safeRenterEmail })}</p>
			<p><strong>${t("bookingRequest.message")}</strong><br>${escapeHtml(message)}</p>
			<p>${t("bookingRequest.cta")}<br><a href="${url}">${url}</a></p>
		`),
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
	const t = getEmailT(renter.language);
	const safeRenterName = escapeHtml(renter.display_name);
	const safeTitle = escapeHtml(booking.listing_title);
	const safeOwnerName = escapeHtml(owner.display_name);
	const safeOwnerEmail = escapeHtml(owner.email);
	const phoneLine = owner.phone ? `<br>${escapeHtml(owner.phone)}` : "";

	await sendEmail({
		to: renter.email,
		subject: t("bookingConfirmed.subject", { title: booking.listing_title }),
		html: wrapEmail(`
			<p>${t("bookingConfirmed.greeting", { name: safeRenterName })}</p>
			<p>${t("bookingConfirmed.body", { title: safeTitle, start: booking.start_date, end: booking.end_date })}</p>
			<p><strong>${t("bookingConfirmed.ownerContact")}</strong><br>${safeOwnerName}<br>${safeOwnerEmail}${phoneLine}</p>
			<p>${t("bookingConfirmed.nextSteps")}</p>
		`),
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
	const t = getEmailT(renter.language);
	const safeRenterName = escapeHtml(renter.display_name);
	const safeTitle = escapeHtml(booking.listing_title);
	const reasonBlock = reason
		? `<p><strong>${t("bookingRejected.reasonLabel")}</strong><br>${escapeHtml(reason)}</p>`
		: "";

	await sendEmail({
		to: renter.email,
		subject: t("bookingRejected.subject", { title: booking.listing_title }),
		html: wrapEmail(`
			<p>${t("bookingRejected.greeting", { name: safeRenterName })}</p>
			<p>${t("bookingRejected.body", { title: safeTitle, start: booking.start_date, end: booking.end_date })}</p>
			${reasonBlock}
			<p>${t("bookingRejected.fallback")}</p>
		`),
		idempotencyKey: `booking-rejected/${booking.short_id}`,
	});
}

export async function sendBookingAutoRejectedEmail(args: {
	booking: BookingSummary;
	renter: PartyInfo;
}): Promise<void> {
	const { booking, renter } = args;
	const t = getEmailT(renter.language);
	const safeRenterName = escapeHtml(renter.display_name);

	await sendEmail({
		to: renter.email,
		subject: t("bookingAutoRejected.subject", { title: booking.listing_title }),
		html: wrapEmail(`
			<p>${t("bookingAutoRejected.greeting", { name: safeRenterName })}</p>
			<p>${t("bookingAutoRejected.body", { start: booking.start_date, end: booking.end_date })}</p>
			<p>${t("bookingAutoRejected.fallback")}</p>
		`),
		idempotencyKey: `booking-auto-rejected/${booking.short_id}`,
	});
}

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) =>
		c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
	);
}
