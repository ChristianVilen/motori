import { Combobox } from "@base-ui/react/combobox";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "~/lib/i18n";
import { MUNICIPALITIES, type Municipality } from "~/lib/municipalities";

interface CitySelectProps {
	value: string;
	onChange: (city: string, region: string) => void;
	onBlur?: () => void;
	id?: string;
	placeholder?: string;
}

// Live region content must come from the internally filtered list, and
// useFilteredItems reads Root context, so this lives in its own child.
function CityStatus() {
	const { t } = useTranslation("common");
	const items = Combobox.useFilteredItems<Municipality>();
	return (
		<Combobox.Status className="sr-only">
			{items.length === 1
				? t("citySelect.oneResult")
				: t("citySelect.manyResults", { count: items.length })}
		</Combobox.Status>
	);
}

export function CitySelect({ value, onChange, onBlur, id, placeholder }: CitySelectProps) {
	const { t } = useTranslation("common");
	// sensitivity "base" = case-insensitive; fi collation keeps ä/ö distinct from a/o.
	const filter = Combobox.useFilter({ locale: "fi", sensitivity: "base" });
	const selected = MUNICIPALITIES.find((m) => m.name === value) ?? null;

	return (
		<Combobox.Root
			items={MUNICIPALITIES}
			value={selected}
			onValueChange={(m) => {
				if (m) {
					onChange(m.name, m.region);
				}
			}}
			onInputValueChange={(text) => {
				// Commit-on-type: an exact name match counts as a pick without
				// needing Enter or a click.
				const typed = text.trim().toLowerCase();
				const match = MUNICIPALITIES.find((m) => m.name.toLowerCase() === typed);
				if (match && match.name !== value) {
					onChange(match.name, match.region);
				}
			}}
			itemToStringLabel={(m: Municipality) => m.name}
			filter={filter.contains}
			autoHighlight
			autoComplete="off"
		>
			<div className="relative">
				<Combobox.Input
					id={id}
					placeholder={placeholder}
					onBlur={onBlur}
					className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 pr-8 text-base ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 md:text-sm"
				/>
				<ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
			</div>
			<Combobox.Portal>
				<Combobox.Positioner sideOffset={4} className="z-50">
					<Combobox.Popup className="max-h-60 w-[var(--anchor-width)] overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
						<CityStatus />
						<Combobox.Empty className="px-3 py-1.5 text-sm text-muted">
							{t("citySelect.noResults")}
						</Combobox.Empty>
						<Combobox.List>
							{(m: Municipality) => (
								<Combobox.Item
									key={m.name}
									value={m}
									className="cursor-default select-none rounded-sm px-3 py-1.5 text-sm data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[selected]:bg-accent data-[selected]:text-accent-foreground"
								>
									{m.name}
								</Combobox.Item>
							)}
						</Combobox.List>
					</Combobox.Popup>
				</Combobox.Positioner>
			</Combobox.Portal>
		</Combobox.Root>
	);
}
