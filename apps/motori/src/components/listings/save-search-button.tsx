import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import type { SavedSearch } from "~/lib/db/schema";
import { handleAppError } from "~/lib/errors-client";
import { useTranslation } from "~/lib/i18n";
import { useLoginPrompt } from "~/lib/login-prompt-context";
import { saveSearchFn } from "~/lib/saved-searches-fns";
import type { BrowseSearchParams } from "~/lib/validators";

interface SaveSearchButtonProps {
	category: SavedSearch["category"];
	search: BrowseSearchParams;
	enabled: boolean;
}

export function SaveSearchButton({ category, search, enabled }: SaveSearchButtonProps) {
	const { t } = useTranslation("listings");
	const { loggedIn, requireLogin } = useLoginPrompt();

	async function handleClick() {
		if (!loggedIn) {
			requireLogin();
			return;
		}
		try {
			await saveSearchFn({ data: { category, params: search } });
			toast.success(t("browse.saveSearchSaved"));
		} catch (err) {
			handleAppError(err, t);
		}
	}

	return (
		<button
			data-testid="save-search-button"
			type="button"
			disabled={!enabled}
			onClick={handleClick}
			aria-label={t("browse.saveSearch")}
			className="inline-flex min-h-10 shrink-0 items-center gap-2 justify-self-end rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted-light disabled:bg-transparent disabled:text-muted disabled:opacity-60"
		>
			<Bookmark className="h-5 w-5" />
			<span>{t("browse.saveSearch")}</span>
		</button>
	);
}
