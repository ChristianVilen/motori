import type { BookingStatus } from "~/lib/db/schema";
import { useTranslation } from "~/lib/i18n";

const styles: Record<BookingStatus, string> = {
	pending: "bg-muted-light text-foreground",
	confirmed: "bg-reflector text-foreground",
	rejected: "border border-foreground text-foreground",
	cancelled: "border border-foreground text-foreground",
	expired: "text-muted",
};
export function BookingStatusPill({ status }: { status: BookingStatus }) {
	const { t } = useTranslation("profile");
	return (
		<span
			className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}
		>
			{t(`bookings.status.${status}`)}
		</span>
	);
}
