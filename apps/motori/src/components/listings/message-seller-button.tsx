import { cn } from "@motori/ui/cn";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "~/lib/i18n";
import { startConversation } from "~/lib/messages";

export function MessageSellerButton({
	listingId,
	className,
}: {
	listingId: string;
	className: string;
}) {
	const { t } = useTranslation("listings");
	const navigate = useNavigate();
	const [startingConversation, setStartingConversation] = useState(false);

	async function onClick() {
		setStartingConversation(true);
		try {
			const { conversationId } = await startConversation({ data: { listingId } });
			// navigate() resolves after the next route has loaded, so the button stays disabled until the page changes.
			await navigate({ to: "/viestit/$conversationId", params: { conversationId } });
		} finally {
			setStartingConversation(false);
		}
	}

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={startingConversation}
			className={cn(className, "disabled:opacity-50")}
		>
			{t("detail.messageSeller", "Lähetä viesti")}
		</button>
	);
}
