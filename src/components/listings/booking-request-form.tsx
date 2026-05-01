import { useState } from "react";
import { AvailabilityCalendar } from "~/components/listings/availability-calendar";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { useTranslation } from "~/lib/i18n";

interface Props {
    listingId: string;
    availabilityDefault: "open" | "closed";
    exceptionDates: string[];
    bookedDates: string[];
    isLoggedIn: boolean;
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
            // TODO: error message from localised texts
            let msg = err instanceof Error ? err.message : String(err);
            try {
                const parsed = JSON.parse(msg);
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].message) {
                    msg = parsed.map((p: any) => p.message).join(", ");
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
