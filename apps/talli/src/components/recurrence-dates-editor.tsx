import { Button } from "@motori/ui/button";
import { Input } from "@motori/ui/input";

interface Props {
	/** Full YYYY-MM-DD values (one per reminder date). */
	dates: string[];
	onChange: (dates: string[]) => void;
	max?: number;
}

export function RecurrenceDatesEditor({ dates, onChange, max = 4 }: Props) {
	function setAt(i: number, value: string) {
		onChange(dates.map((d, j) => (j === i ? value : d)));
	}
	function removeAt(i: number) {
		onChange(dates.filter((_, j) => j !== i));
	}
	return (
		<div className="grid gap-2" data-testid="recurrence-dates">
			{dates.map((d, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: date rows are positional
				<div key={i} className="flex items-center gap-2">
					<Input
						type="date"
						required
						data-testid={`recurrence-date-${i}`}
						value={d}
						onChange={(e) => setAt(i, e.target.value)}
					/>
					{dates.length > 1 ? (
						<Button
							type="button"
							size="sm"
							variant="ghost"
							data-testid={`recurrence-remove-${i}`}
							onClick={() => removeAt(i)}
						>
							Poista
						</Button>
					) : null}
				</div>
			))}
			{dates.length < max ? (
				<Button
					type="button"
					size="sm"
					variant="outline"
					data-testid="recurrence-add"
					onClick={() => onChange([...dates, ""])}
				>
					＋ Lisää päivä
				</Button>
			) : null}
		</div>
	);
}

/** MM-DD anchors from full YYYY-MM-DD picker values, dropping empties. */
export function toAnchors(dates: string[]): string[] {
	return dates.filter(Boolean).map((d) => d.slice(5));
}

/** Seed picker values from stored MM-DD anchors, using the given year. */
export function fromAnchors(anchors: string[], year: number): string[] {
	return anchors.map((a) => `${year}-${a}`);
}
