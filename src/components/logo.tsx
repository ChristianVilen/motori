interface LogoProps {
	/** "light" = dark text for light backgrounds, "dark" = white text for dark backgrounds */
	variant?: "light" | "dark";
	className?: string;
}

export function Logo({ variant = "light", className }: LogoProps) {
	const textFill = variant === "dark" ? "#ffffff" : "#14142b";
	const markStroke = variant === "dark" ? "#ffffff" : "#14142b";

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 220 64"
			width="220"
			height="64"
			className={className}
			aria-label="Motori"
			role="img"
		>
			<path
				d="M14 44 A 20 20 0 0 1 50 44"
				fill="none"
				stroke={markStroke}
				strokeWidth="7"
				strokeLinecap="round"
			/>
			<circle cx="44" cy="26" r="5" fill="#e07a3a" />
			<text
				x="68"
				y="46"
				fontFamily="'Space Grotesk Variable', 'Space Grotesk', sans-serif"
				fontWeight="700"
				fontSize="34"
				letterSpacing="-0.02em"
				fill={textFill}
			>
				Motori
			</text>
		</svg>
	);
}
