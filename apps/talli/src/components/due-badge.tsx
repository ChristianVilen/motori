import { cn } from "@motori/ui/cn";
import type { DueState } from "~/lib/due-state";

const LABELS = { ok: "OK", due_soon: "Erääntyy pian", overdue: "Erääntynyt" } as const;

export function dueDetail(state: DueState): string | null {
	if (state.dueInKm !== null && state.dueInKm < 0) {
		return `${Math.abs(state.dueInKm)} km yli`;
	}
	if (state.dueInDays !== null && state.dueInDays < 0) {
		return `${Math.abs(state.dueInDays)} pv yli`;
	}
	const parts: string[] = [];
	if (state.dueInKm !== null) {
		parts.push(`${state.dueInKm} km`);
	}
	if (state.dueInDays !== null) {
		parts.push(`${state.dueInDays} pv`);
	}
	return parts.length ? `${parts.join(" / ")} jäljellä` : null;
}

export function DueBadge({ state }: { state: DueState }) {
	return (
		<span
			data-testid="due-badge"
			data-status={state.status}
			className={cn(
				"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
				state.status === "ok" && "bg-muted-light text-muted",
				state.status === "due_soon" && "bg-warning/15 text-warning",
				state.status === "overdue" && "bg-destructive/15 text-destructive",
			)}
		>
			{LABELS[state.status]}
		</span>
	);
}
