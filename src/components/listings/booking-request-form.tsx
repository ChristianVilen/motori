import { useState } from "react";
import { AvailabilityCalendar } from "~/components/listings/availability-calendar";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { formatEur, useTranslation } from "~/lib/i18n";

interface Props {
	listingId: string;
	availabilityDefault: "open" | "closed";
	exceptionDates: string[];
	bookedDates: string[];
	isLoggedIn: boolean;
	pricePerDayCents: number;
	pricePerWeekCents: number | null;
	pricePerWeekendCents: number | null;
	onSubmit: (input: { start_date: string; end_date: string; message: string }) => Promise<void>;
}

export interface BookingCost {
	totalCents: number;
	days: number;
	label: "weekend" | "week" | null;
}

export function computeBookingCost(
	from: string,
	to: string,
	pricePerDayCents: number,
	pricePerWeekCents: number | null,
	pricePerWeekendCents: number | null,
): BookingCost {
	const start = new Date(`${from}T00:00:00Z`);
	const end = new Date(`${to}T00:00:00Z`);
	const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

	// Fri=5, Sun=0 in UTC
	const startDay = start.getUTCDay();
	const endDay = end.getUTCDay();
	if (days === 3 && startDay === 5 && endDay === 0 && pricePerWeekendCents) {
		return { totalCents: pricePerWeekendCents, days, label: "weekend" };
	}

	if (days >= 7 && pricePerWeekCents) {
		const fullWeeks = Math.floor(days / 7);
		const remainingDays = days % 7;
		return {
			totalCents: fullWeeks * pricePerWeekCents + remainingDays * pricePerDayCents,
			days,
			label: "week",
		};
	}

	return { totalCents: days * pricePerDayCents, days, label: null };
}

export function BookingRequestForm(props: Props) {
	const { t } = useTranslation("listings");
	const [range, setRange] = useState<{ from: string; to: string } | null>(null);
	const [message, setMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const cost = range
		? computeBookingCost(
				range.from,
				range.to,
				props.pricePerDayCents,
				props.pricePerWeekCents,
				props.pricePerWeekendCents,
			)
		: null;

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
			let msg = err instanceof Error ? err.message : String(err);
			try {
				const parsed = JSON.parse(msg);
				if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].message) {
					msg = parsed.map((p) => p.message).join(", ");
				}
			} catch {
				// Not JSON, use original message
			}
			setError(msg);
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
			<h3 className="font-semibold">{t("booking.calendarTitle")}</h3>
			<AvailabilityCalendar
				bookedDates={props.bookedDates}
				exceptionDates={props.exceptionDates}
				availabilityDefault={props.availabilityDefault}
				mode={props.isLoggedIn ? "select-range" : "view-only"}
				selectedRange={range}
				onSelectRange={setRange}
			/>
			{cost ? (
				<div data-testid="booking-cost" className="flex items-baseline gap-2">
					<span className="font-semibold">
						{t("booking.costSummary", { days: cost.days, total: formatEur(cost.totalCents) })}
					</span>
					{cost.label === "weekend" && (
						<span className="text-xs text-muted">{t("booking.costLabelWeekend")}</span>
					)}
					{cost.label === "week" && (
						<span className="text-xs text-muted">{t("booking.costLabelWeek")}</span>
					)}
				</div>
			) : null}
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
