import { cn } from "./cn";

interface LogoProps {
	variant?: "light" | "dark";
	className?: string;
}

export function Logo({ variant = "light", className }: LogoProps) {
	return (
		<span
			className={cn(
				"flex w-fit items-center font-heading text-[27px] leading-none font-extrabold tracking-[-0.05em]",
				variant === "dark" ? "text-white" : "text-foreground",
				className,
			)}
		>
			<span className="sr-only">Motori</span>
			<span aria-hidden="true">
				motor<span className="wordmark-i">ı</span>
			</span>
		</span>
	);
}
