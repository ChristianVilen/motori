export function categoryChipClass(isActive: boolean): string {
	return `shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
		isActive ? "bg-primary text-white" : "border border-border bg-background text-foreground"
	}`;
}
