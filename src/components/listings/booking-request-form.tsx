import { useState } from "react";
import { BookingCalendar } from "~/components/listings/booking-calendar";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
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
	onClose?: () => void;
	onSubmit: (input: { start_date: string; end_date: string; message: string }) => Promise<void>;
}

export function BookingRequestForm(props: Props) {
	const { t } = useTranslation("listings");
	const [range, setRange] = useState<{ from: string; to: string } | null>(null);
	const [message, setMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

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
					msg = parsed.map((p: { message: string }) => p.message).join(", ");
				}
			} catch {
				// not JSON
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
			<BookingCalendar
				bookedDates={props.bookedDates}
				exceptionDates={props.exceptionDates}
				availabilityDefault={props.availabilityDefault}
				pricePerDayCents={props.pricePerDayCents}
				pricePerWeekCents={props.pricePerWeekCents}
				pricePerWeekendCents={props.pricePerWeekendCents}
				heroImageUrl={props.heroImageUrl}
				selectedRange={range}
				onSelectRange={setRange}
				onClose={props.onClose}
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
