import { useMemo, useState } from "react";
import { BookingCalendar } from "~/components/listings/booking-calendar";
import { BookingPricing } from "~/components/listings/booking-pricing";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { type BookingCost, computeBookingCost } from "~/lib/bookings";
import { fromIso } from "~/lib/calendar-helpers";
import { handleAppError } from "~/lib/errors-client";
import { useTranslation } from "~/lib/i18n";

interface Props {
	listingId: string;
	availabilityDefault: "open" | "closed";
	exceptionDates: string[];
	bookedDates: string[];
	isLoggedIn: boolean;
	pricePerDayCents: number;
	pricePerWeekCents: number | null;
	pricePerWeekendCents: number | null;
	heroImageUrl?: string | null;
	onSubmit: (input: { start_date: string; end_date: string; message: string }) => Promise<void>;
}

export function BookingRequestForm(props: Props) {
	const { t } = useTranslation("listings");
	const [range, setRange] = useState<{ from: string; to: string } | null>(null);
	const [maxStayError, setMaxStayError] = useState(false);
	const [message, setMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const cost: BookingCost | null = useMemo(
		() =>
			range
				? computeBookingCost(
						range.from,
						range.to,
						props.pricePerDayCents,
						props.pricePerWeekCents,
						props.pricePerWeekendCents,
					)
				: null,
		[range, props.pricePerDayCents, props.pricePerWeekCents, props.pricePerWeekendCents],
	);

	const fromDate = range ? fromIso(range.from) : null;
	const toDate = range ? fromIso(range.to) : null;

	function handleSelectRange(r: { from: string; to: string } | null, wasClamped?: boolean) {
		setRange(r);
		setMaxStayError(!!wasClamped);
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!range) {
			return;
		}
		setSubmitting(true);
		setError(null);
		try {
			await props.onSubmit({
				start_date: range.from,
				end_date: range.to,
				message: message.trim(),
			});
			setSuccess(true);
		} catch (err) {
			setError(null);
			const fieldError = handleAppError(err, t);
			if (fieldError) {
				setError(fieldError.message);
			}
		} finally {
			setSubmitting(false);
		}
	}

	if (success) {
		return (
			<div
				data-testid="booking-success"
				className="rounded-l border border-success/30 bg-success/5 p-4"
			>
				<h3 className="font-semibold text-success">{t("booking.successTitle")}</h3>
				<p className="mt-1 text-sm text-muted">{t("booking.successBody")}</p>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4" data-testid="booking-request-form">
			<BookingPricing
				cost={cost}
				maxStayError={maxStayError}
				heroImageUrl={props.heroImageUrl}
				fromDate={fromDate}
				toDate={toDate}
				from={range?.from ?? null}
				to={range?.to ?? null}
				pricePerDayCents={props.pricePerDayCents}
				pricePerWeekCents={props.pricePerWeekCents}
				pricePerWeekendCents={props.pricePerWeekendCents}
				t={t}
			/>

			<BookingCalendar
				bookedDates={props.bookedDates}
				exceptionDates={props.exceptionDates}
				availabilityDefault={props.availabilityDefault}
				selectedRange={range}
				onSelectRange={handleSelectRange}
			/>

			{!props.isLoggedIn ? (
				<p className="text-sm text-muted">{t("booking.loginRequired")}</p>
			) : (
				<>
					<label htmlFor="booking-message" className="block">
						<span className="text-sm font-medium">{t("booking.messageLabel")}</span>
						<Textarea
							id="booking-message"
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							placeholder={t("booking.messagePlaceholder")}
							maxLength={500}
							rows={4}
							required
						/>
					</label>
					{error ? <p className="text-sm text-destructive">{error}</p> : null}
					<Button
						type="submit"
						disabled={!range || message.trim().length === 0 || submitting}
						data-testid="booking-submit"
					>
						{submitting ? t("booking.submitting") : t("booking.submitButton")}
					</Button>
				</>
			)}
		</form>
	);
}
