import type { TFunction } from "i18next";
import { toast } from "sonner";

interface ParsedAppError {
	code: string;
	field?: string;
	context?: Record<string, string | number>;
}

/** Extract structured error payload from a caught error. */
export function parseAppError(error: unknown): ParsedAppError | null {
	const message = error instanceof Error ? error.message : typeof error === "string" ? error : null;
	if (!message) {
		return null;
	}

	try {
		const parsed = JSON.parse(message);
		if (typeof parsed === "object" && parsed !== null && typeof parsed.code === "string") {
			return parsed as ParsedAppError;
		}
	} catch {
		// Not a JSON-encoded AppError
	}
	return null;
}

/**
 * Handle a caught error: parse it, localise it, and either return a field error
 * for inline display or show a toast for global errors.
 */
export function handleAppError(
	error: unknown,
	t: TFunction,
): { message: string; field: string } | null {
	const parsed = parseAppError(error);
	if (!parsed) {
		toast.error(t("errors:generic"));
		return null;
	}

	const key = `errors:${parsed.code}`;
	const message = t(key, parsed.context ?? {});

	if (parsed.field) {
		return { message, field: parsed.field };
	}

	toast.error(message);
	return null;
}
