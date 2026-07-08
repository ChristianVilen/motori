import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MUNICIPALITIES, type Municipality } from "~/lib/municipalities";

interface CitySelectProps {
	value: string;
	onChange: (city: string, region: string) => void;
	onBlur?: () => void;
	id?: string;
	placeholder?: string;
}

export function CitySelect({ value, onChange, onBlur, id, placeholder }: CitySelectProps) {
	const [open, setOpen] = useState(false);
	const [filter, setFilter] = useState(value);
	const ref = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Sync external value changes
	useEffect(() => {
		setFilter(value);
	}, [value]);

	useEffect(() => {
		function onClickOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
				// Reset filter to current value if user didn't pick
				if (!MUNICIPALITIES.some((m) => m.name === filter)) {
					setFilter(value);
				}
				onBlur?.();
			}
		}
		document.addEventListener("mousedown", onClickOutside);
		return () => document.removeEventListener("mousedown", onClickOutside);
	}, [filter, value, onBlur]);

	const filtered = filter
		? MUNICIPALITIES.filter((m) => m.name.toLowerCase().startsWith(filter.toLowerCase()))
		: MUNICIPALITIES;

	function select(m: Municipality) {
		setFilter(m.name);
		onChange(m.name, m.region);
		setOpen(false);
		onBlur?.();
	}

	return (
		<div ref={ref} className="relative">
			<div className="relative">
				<input
					ref={inputRef}
					id={id}
					type="text"
					autoComplete="off"
					value={filter}
					placeholder={placeholder}
					className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 pr-8 text-base ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 md:text-sm"
					onChange={(e) => {
						setFilter(e.target.value);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					onKeyDown={(e) => {
						if (e.key === "Escape") {
							setOpen(false);
							inputRef.current?.blur();
						}
						if (e.key === "Enter" && filtered.length === 1) {
							e.preventDefault();
							select(filtered[0]);
						}
					}}
				/>
				<ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
			</div>
			{open && filtered.length > 0 && (
				<div
					role="listbox"
					className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
				>
					{filtered.slice(0, 50).map((m) => (
						<div
							key={m.name}
							role="option"
							tabIndex={-1}
							aria-selected={m.name === value}
							className="cursor-default select-none rounded-sm px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground data-[selected]:bg-accent data-[selected]:text-accent-foreground"
							data-selected={m.name === value ? "" : undefined}
							onMouseDown={(e) => {
								e.preventDefault();
								select(m);
							}}
						>
							{m.name}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
