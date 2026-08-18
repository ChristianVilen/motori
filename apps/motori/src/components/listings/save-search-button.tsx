import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import type { ListingCategory } from "~/lib/db/schema";
import { handleAppError } from "~/lib/errors-client";
import { useTranslation } from "~/lib/i18n";
import { useLoginPrompt } from "~/lib/login-prompt-context";
import { saveSearchFn } from "~/lib/saved-searches-fns";
import {
	type BrowseSearchParams,
	countActiveFilters,
	savedSearchParamsSchema,
} from "~/lib/validators";

interface SaveSearchButtonProps {
	category: ListingCategory;
	search: BrowseSearchParams;
}

export function SaveSearchButton({ category, search }: SaveSearchButtonProps) {
	const { t } = useTranslation("listings");
	const { loggedIn, requireLogin } = useLoginPrompt();

	const enabled = (search.q ?? "").trim() !== "" || countActiveFilters(search) > 0;

	async function handleClick() {
		if (!loggedIn) {
			requireLogin();
			return;
		}
		try {
			await saveSearchFn({ data: { category, params: savedSearchParamsSchema.parse(search) } });
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
			className="flex h-11 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm text-white hover:bg-white/15 disabled:opacity-50"
		>
			<Bookmark className="h-5 w-5" />
			<span className="hidden sm:inline">{t("browse.saveSearch")}</span>
		</button>
	);
}
