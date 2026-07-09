export class AppError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AppError";
	}
}

/** Client-side: turn a thrown/serialized error into a user-safe Finnish message.
 *  A serialized ZodError arrives as a plain Error whose message is a JSON dump —
 *  never show that to the user. */
export function formErrorMessage(err: unknown): string {
	const raw = err instanceof Error ? err.message : String(err);
	const trimmed = raw.trim();
	if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
		return "Tarkista syötteet ja yritä uudelleen.";
	}
	return raw || "Jotain meni pieleen.";
}
