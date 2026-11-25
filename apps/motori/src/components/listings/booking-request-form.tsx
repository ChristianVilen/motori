import { Button } from "@motori/ui/button";
import { Textarea } from "@motori/ui/textarea";
import { useState } from "react";
import { useTranslation } from "~/lib/i18n";

export function BookingRequestForm({
	title,
	ready,
	onSubmit,
}: {
	title: string;
	ready: boolean;
	onSubmit: (message: string) => Promise<string | undefined | undefined>;
}) {
	const { t } = useTranslation("listings");
	const [message, setMessage] = useState("");
	const [fieldError, setFieldError] = useState<string>();
	const [invalid, setInvalid] = useState(false);
	const [sending, setSending] = useState(false);
	return (
		<form
			data-testid="booking-request-form"
			noValidate
			className="grid gap-3"
			onSubmit={async (event) => {
				event.preventDefault();
				if (!ready || sending) {
					return;
				}
				if (!message.trim()) {
					setInvalid(true);
					event.currentTarget.querySelector("textarea")?.focus();
					return;
				}
				setSending(true);
				try {
					setFieldError((await onSubmit(message.trim())) || undefined);
				} finally {
					setSending(false);
				}
			}}
		>
			<p className="font-heading text-lg font-semibold">{title}</p>
			<label htmlFor="booking-message" className="text-sm font-semibold">
				{t("booking.messageLabel")}
			</label>
			<Textarea
				id="booking-message"
				data-testid="booking-message"
				required
				aria-invalid={invalid || !!fieldError}
				aria-describedby={
					invalid || fieldError
						? "booking-message-error booking-message-count"
						: "booking-message-count"
				}
				maxLength={500}
				rows={4}
				value={message}
				onChange={(e) => {
					setMessage(e.target.value);
					setFieldError(undefined);
					if (e.target.value.trim()) {
						setInvalid(false);
					}
				}}
				placeholder={t("booking.messagePlaceholder")}
			/>
			<span id="booking-message-count" className="text-right text-xs text-muted tabular-nums">
				{message.length} / 500
			</span>
			{invalid || fieldError ? (
				<p id="booking-message-error" role="alert" className="text-sm text-destructive">
					{fieldError ?? t("booking.requiredMessage")}
				</p>
			) : null}
			<p className="text-sm text-muted">{t("booking.notice")}</p>
			<Button
				variant="reflector"
				type="submit"
				disabled={!ready || sending}
				data-testid="booking-submit"
			>
				{t(sending ? "booking.submitting" : "booking.submitButton")}
			</Button>
		</form>
	);
}
