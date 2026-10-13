import { Button } from "@motori/ui/button";
import { useTranslation } from "~/lib/i18n";

export function RemoveButton({ label, onRemove }: { label: string; onRemove: () => void }) {
	const { t } = useTranslation("contract");

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className="h-auto px-1.5 py-0 font-sans text-xs print:hidden"
			aria-label={t("removeNamed", { name: label })}
			onClick={onRemove}
		>
			{t("remove")}
		</Button>
	);
}

export function RestoreLine({ label, onRestore }: { label: string; onRestore: () => void }) {
	const { t } = useTranslation("contract");

	return (
		<div className="flex w-full items-center justify-between gap-3 border-b border-border font-sans text-sm print:hidden">
			<span>{label}</span>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="h-7 px-2 text-xs"
				aria-label={t("restoreNamed", { name: label })}
				onClick={onRestore}
			>
				{t("restore")}
			</Button>
		</div>
	);
}
