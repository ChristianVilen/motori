import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslation } from "~/lib/i18n";

interface CollapsibleSidebarProps {
	open: boolean;
	onToggle: (open: boolean) => void;
	/** Height variant for the collapsed strip. */
	collapsedHeight?: "screen" | "full";
	children: React.ReactNode;
}

const collapsedHeightClass = {
	screen: "h-screen",
	full: "h-full",
} as const;

export function CollapsibleSidebar({
	open,
	onToggle,
	collapsedHeight = "screen",
	children,
}: CollapsibleSidebarProps) {
	const { t } = useTranslation("listings");

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => onToggle(true)}
				className={`flex ${collapsedHeightClass[collapsedHeight]} w-10 items-start justify-center border-r border-border pt-4 text-muted transition-colors hover:bg-muted-light hover:text-foreground`}
				aria-label={t("browse.showFilters")}
			>
				<PanelLeftOpen className="h-4 w-4" />
			</button>
		);
	}

	return (
		<>
			{children}
			<button
				type="button"
				onClick={() => onToggle(false)}
				className="mt-4 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted transition-colors hover:bg-muted-light hover:text-foreground"
			>
				<PanelLeftClose className="h-4 w-4 shrink-0" />
				{t("browse.collapseSidebar")}
			</button>
		</>
	);
}
