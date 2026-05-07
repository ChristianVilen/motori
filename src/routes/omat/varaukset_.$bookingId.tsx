import { createFileRoute, Link, notFound, redirect, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "kysely";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
	cancelBooking as cancelBookingAction,
	confirmBooking as confirmBookingAction,
	rejectBooking as rejectBookingAction,
} from "~/lib/bookings.server";
import { SITE_NAME } from "~/lib/constants";
import { db } from "~/lib/db/index";
import type { BookingStatus } from "~/lib/db/schema";
import { AppError } from "~/lib/errors";
import { handleAppError } from "~/lib/errors-client";
import { useTranslation } from "~/lib/i18n";
import { protectedMutation } from "~/lib/middleware";
import { isReviewEligible } from "~/lib/reviews";
import {
	getReviewStatusForBooking,
	type ReviewStatus,
	submitReview as submitReviewAction,
} from "~/lib/reviews.server";
import { getSession } from "~/lib/session";
import { bookingIdSchema, bookingRejectSchema, submitReviewSchema } from "~/lib/validators";

const getBooking = createServerFn({ method: "GET" })
	.inputValidator((shortId: string) => shortId)
	.handler(async ({ data: shortId }) => {
		const session = await getSession();
		if (!session) {
			throw new AppError("auth.unauthorized");
		}

		const row = await db
			.selectFrom("booking")
			.innerJoin("listing", "listing.id", "booking.listing_id")
			.innerJoin("user as renter_user", "renter_user.id", "booking.renter_user_id")
			.innerJoin("profile as renter_profile", "renter_profile.user_id", "booking.renter_user_id")
			.innerJoin("user as owner_user", "owner_user.id", "listing.owner_id")
			.innerJoin("profile as owner_profile", "owner_profile.user_id", "listing.owner_id")
			.select([
				"booking.id",
				"booking.short_id",
				"booking.status",
				"booking.message",
				"booking.rejection_reason",
				sql<string>`to_char(booking.start_date, 'YYYY-MM-DD')`.as("start_date"),
				sql<string>`to_char(booking.end_date, 'YYYY-MM-DD')`.as("end_date"),
				"booking.created_at",
				"listing.id as listing_id",
				"listing.title as listing_title",
				"listing.short_id as listing_short_id",
				"listing.owner_id",
				"renter_user.id as renter_id",
				"renter_user.email as renter_email",
				"renter_profile.display_name as renter_name",
				"renter_profile.phone as renter_phone",
				"renter_profile.show_phone as renter_show_phone",
				"owner_user.email as owner_email",
				"owner_profile.display_name as owner_name",
				"owner_profile.phone as owner_phone",
				"owner_profile.show_phone as owner_show_phone",
			])
			.where("booking.short_id", "=", shortId)
			.executeTakeFirst();

		if (!row) {
			return null;
		}

		const isOwner = row.owner_id === session.user.id;
		const isRenter = row.renter_id === session.user.id;
		if (!isOwner && !isRenter) {
			throw new AppError("listing.forbidden");
		}

		const renterPhone = row.renter_show_phone ? row.renter_phone : null;
		const ownerPhone = row.owner_show_phone ? row.owner_phone : null;
		const renterContact = isOwner
			? { name: row.renter_name, email: row.renter_email, phone: renterPhone }
			: null;
		const ownerContact =
			isRenter && row.status === "confirmed"
				? { name: row.owner_name, email: row.owner_email, phone: ownerPhone }
				: null;

		const eligible = isReviewEligible(row.status as BookingStatus, row.end_date);
		const reviewStatus = eligible
			? await getReviewStatusForBooking(row.id, session.user.id, row.end_date)
			: null;

		return {
			booking: {
				id: row.id,
				short_id: row.short_id,
				status: row.status as BookingStatus,
				message: row.message,
				rejection_reason: row.rejection_reason,
				start_date: row.start_date,
				end_date: row.end_date,
				created_at: row.created_at,
				listing_title: row.listing_title,
				listing_short_id: row.listing_short_id,
			},
			role: isOwner ? ("owner" as const) : ("renter" as const),
			renterContact,
			ownerContact,
			reviewStatus,
		};
	});

const confirmBooking = createServerFn({ method: "POST" })
	.middleware(protectedMutation("confirm-booking", 10, 60))
	.inputValidator((data: unknown) => bookingIdSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new AppError("auth.unauthorized");
		}

		return confirmBookingAction({ bookingId: data.id, userId: session.user.id });
	});

const rejectBooking = createServerFn({ method: "POST" })
	.middleware(protectedMutation("reject-booking", 10, 60))
	.inputValidator((data: unknown) => bookingRejectSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new AppError("auth.unauthorized");
		}

		await rejectBookingAction({
			bookingId: data.id,
			userId: session.user.id,
			reason: data.reason,
		});
	});

const cancelBooking = createServerFn({ method: "POST" })
	.middleware(protectedMutation("cancel-booking", 10, 60))
	.inputValidator((data: unknown) => bookingIdSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new AppError("auth.unauthorized");
		}

		await cancelBookingAction({ bookingId: data.id, userId: session.user.id });
	});

const submitReview = createServerFn({ method: "POST" })
	.middleware(protectedMutation("submit-review", 10, 60))
	.inputValidator((data: unknown) => submitReviewSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new AppError("auth.unauthorized");
		}

		await submitReviewAction({
			bookingId: data.booking_id,
			userId: session.user.id,
			rating: data.rating,
			comment: data.comment,
		});
	});

export const Route = createFileRoute("/omat/varaukset_/$bookingId")({
	loader: async ({ params }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({
				to: "/kirjaudu",
				search: { redirect: `/omat/varaukset/${params.bookingId}` },
			});
		}
		const result = await getBooking({ data: params.bookingId });
		if (!result) {
			throw notFound();
		}
		return result;
	},
	head: () => ({ meta: [{ title: `Varaus — ${SITE_NAME}` }] }),
	component: BookingDetailPage,
});

function ContactBlock(props: { label: string; name: string; email: string; phone: string | null }) {
	return (
		<div className="mt-4">
			<div className="text-xs font-semibold uppercase text-muted">{props.label}</div>
			<p className="mt-1 text-sm">
				{props.name}
				<br />
				<a className="text-accent" href={`mailto:${props.email}`}>
					{props.email}
				</a>
				{props.phone ? <br /> : null}
				{props.phone ? (
					<a className="text-accent" href={`tel:${props.phone}`}>
						{props.phone}
					</a>
				) : null}
			</p>
		</div>
	);
}

function OwnerActions(props: {
	bookingId: string;
	busy: boolean;
	onBusyChange: (v: boolean) => void;
	onAutoRejected: (n: number) => void;
	onRefresh: () => void;
}) {
	const { t } = useTranslation("profile");
	const [rejectMode, setRejectMode] = useState(false);
	const [rejectReason, setRejectReason] = useState("");

	async function handleConfirm() {
		if (!window.confirm(t("bookings.detail.confirmConfirm"))) {
			return;
		}
		props.onBusyChange(true);
		try {
			const r = await confirmBooking({ data: { id: props.bookingId } });
			props.onAutoRejected(r.autoRejectedCount);
			props.onRefresh();
		} finally {
			props.onBusyChange(false);
		}
	}

	async function handleReject() {
		if (!window.confirm(t("bookings.detail.rejectConfirm"))) {
			return;
		}
		props.onBusyChange(true);
		try {
			await rejectBooking({
				data: { id: props.bookingId, reason: rejectReason.trim() || undefined },
			});
			props.onRefresh();
		} finally {
			props.onBusyChange(false);
			setRejectMode(false);
		}
	}

	return (
		<div className="mt-6 flex flex-wrap gap-3">
			<Button onClick={handleConfirm} disabled={props.busy} data-testid="booking-confirm">
				{t("bookings.detail.confirmButton")}
			</Button>
			{rejectMode ? (
				<div className="flex w-full flex-col gap-2">
					<Textarea
						value={rejectReason}
						onChange={(e) => setRejectReason(e.target.value)}
						placeholder={t("bookings.detail.rejectReasonPlaceholder")}
						maxLength={500}
						rows={3}
					/>
					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={handleReject}
							disabled={props.busy}
							data-testid="booking-reject-confirm"
						>
							{t("bookings.detail.rejectButton")}
						</Button>
						<Button variant="outline" onClick={() => setRejectMode(false)} disabled={props.busy}>
							{t("bookings.detail.rejectDismiss")}
						</Button>
					</div>
				</div>
			) : (
				<Button
					variant="outline"
					onClick={() => setRejectMode(true)}
					disabled={props.busy}
					data-testid="booking-reject"
				>
					{t("bookings.detail.rejectButton")}
				</Button>
			)}
		</div>
	);
}

function ReviewSection(props: {
	bookingId: string;
	reviewStatus: ReviewStatus;
	onRefresh: () => void;
}) {
	const { t } = useTranslation("profile");
	const [rating, setRating] = useState(0);
	const [comment, setComment] = useState("");
	const [busy, setBusy] = useState(false);
	const [localSubmitted, setLocalSubmitted] = useState(false);
	const submitted = localSubmitted || props.reviewStatus.userHasReviewed;
	const [error, setError] = useState<string | null>(null);

	if (submitted && !props.reviewStatus.windowOpen) {
		return (
			<div className="mt-6 rounded-l border border-border bg-card p-4">
				<p className="text-sm text-muted">{t("reviews.revealed")}</p>
			</div>
		);
	}

	if (!props.reviewStatus.windowOpen) {
		return (
			<div className="mt-6 rounded-l border border-border bg-card p-4">
				<p className="text-sm text-muted">{t("reviews.windowClosed")}</p>
			</div>
		);
	}

	if (submitted) {
		return (
			<div className="mt-6 rounded-l border border-border bg-card p-4">
				<p className="text-sm text-muted">{t("reviews.waitingReveal")}</p>
			</div>
		);
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (rating === 0) {
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await submitReview({
				data: { booking_id: props.bookingId, rating, comment: comment.trim() || undefined },
			});
			setLocalSubmitted(true);
			props.onRefresh();
		} catch (err) {
			const fieldError = handleAppError(err, t);
			setError(fieldError ? fieldError.message : t("reviews.submitError"));
		} finally {
			setBusy(false);
		}
	}

	return (
		<div data-testid="review-section" className="mt-6 rounded-l border border-border bg-card p-4">
			<h3 className="mb-3 font-semibold">{t("reviews.submitHeading")}</h3>
			<form onSubmit={handleSubmit} data-testid="review-form">
				<fieldset className="mb-3">
					<legend className="mb-1 block text-sm text-muted">{t("reviews.ratingLabel")}</legend>
					<div className="flex gap-1">
						{[1, 2, 3, 4, 5].map((star) => (
							<button
								key={star}
								type="button"
								onClick={() => setRating(star)}
								className={`text-2xl ${star <= rating ? "text-yellow-500" : "text-gray-300"}`}
								aria-label={`${star} / 5`}
							>
								★
							</button>
						))}
					</div>
				</fieldset>
				<div className="mb-3">
					<label htmlFor="review-comment" className="mb-1 block text-sm text-muted">
						{t("reviews.commentLabel")}
					</label>
					<Textarea
						id="review-comment"
						value={comment}
						onChange={(e) => setComment(e.target.value)}
						placeholder={t("reviews.commentPlaceholder")}
						maxLength={1000}
						rows={3}
					/>
				</div>
				<Button type="submit" disabled={busy || rating === 0} data-testid="review-submit">
					{busy ? t("reviews.submitting") : t("reviews.submitButton")}
				</Button>
				{!!error && <p className="mt-2 text-sm text-red-600">{error}</p>}
			</form>
		</div>
	);
}

function BookingDetailPage() {
	const { booking, role, renterContact, ownerContact, reviewStatus } = Route.useLoaderData();
	const router = useRouter();
	const { t } = useTranslation("profile");
	const [busy, setBusy] = useState(false);
	const [autoRejected, setAutoRejected] = useState<number | null>(null);

	const isPending = booking.status === "pending";

	async function handleCancel() {
		if (!window.confirm(t("bookings.detail.cancelConfirm"))) {
			return;
		}
		setBusy(true);
		try {
			await cancelBooking({ data: { id: booking.id } });
			router.invalidate();
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="mx-auto max-w-2xl px-4 py-8">
			<Link to="/omat/varaukset" className="text-sm text-muted hover:text-accent">
				← {t("bookings.listTitle")}
			</Link>
			<h1 className="mt-2 text-2xl font-bold">{t("bookings.detail.heading")}</h1>
			<div className="mt-4 rounded-l border border-border bg-card p-4">
				<div className="font-medium">{booking.listing_title}</div>
				<div className="mt-1 text-sm text-muted">
					{booking.start_date} – {booking.end_date}
				</div>
				<span className="mt-2 inline-block rounded-full bg-muted-light px-2 py-0.5 text-xs">
					{t(`bookings.status.${booking.status}`)}
				</span>
				<div className="mt-4">
					<div className="text-xs font-semibold uppercase text-muted">
						{t("bookings.detail.messageLabel")}
					</div>
					<p className="mt-1 whitespace-pre-wrap text-sm">{booking.message}</p>
				</div>
				{booking.rejection_reason ? (
					<div className="mt-4">
						<div className="text-xs font-semibold uppercase text-muted">
							{t("bookings.detail.rejectionLabel")}
						</div>
						<p className="mt-1 whitespace-pre-wrap text-sm">{booking.rejection_reason}</p>
					</div>
				) : null}
				{renterContact ? (
					<ContactBlock
						label={t("bookings.detail.renterLabel")}
						name={renterContact.name}
						email={renterContact.email}
						phone={renterContact.phone}
					/>
				) : null}
				{ownerContact ? (
					<ContactBlock
						label={t("bookings.detail.ownerLabel")}
						name={ownerContact.name}
						email={ownerContact.email}
						phone={ownerContact.phone}
					/>
				) : null}
				{autoRejected !== null && autoRejected > 0 ? (
					<p className="mt-4 text-sm text-muted">
						{t("bookings.detail.autoRejectNotice", { count: autoRejected })}
					</p>
				) : null}
			</div>

			{isPending && role === "owner" ? (
				<OwnerActions
					bookingId={booking.id}
					busy={busy}
					onBusyChange={setBusy}
					onAutoRejected={setAutoRejected}
					onRefresh={() => router.invalidate()}
				/>
			) : null}

			{isPending && role === "renter" ? (
				<div className="mt-6">
					<Button
						variant="outline"
						onClick={handleCancel}
						disabled={busy}
						data-testid="booking-cancel"
					>
						{t("bookings.detail.cancelButton")}
					</Button>
				</div>
			) : null}

			{reviewStatus ? (
				<ReviewSection
					bookingId={booking.id}
					reviewStatus={reviewStatus}
					onRefresh={() => router.invalidate()}
				/>
			) : null}
		</div>
	);
}
