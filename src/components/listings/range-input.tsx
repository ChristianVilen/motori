interface RangeInputProps {
	name: string;
	value: number | undefined;
	placeholder: string;
	className: string;
	onChange: (value: number | undefined) => void;
}

export function RangeInput({ name, value, placeholder, className, onChange }: RangeInputProps) {
	return (
		<input
			data-testid={name}
			type="number"
			placeholder={placeholder}
			defaultValue={value ?? ""}
			onBlur={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.currentTarget.blur();
				}
			}}
			className={className}
		/>
	);
}
