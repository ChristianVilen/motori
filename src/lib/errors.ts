/**
 * Structured application error. Serialises code + metadata into the message
 * so it survives TanStack Start's error serialization across the wire.
 */
export class AppError extends Error {
	readonly code: string;
	readonly field?: string;
	readonly context?: Record<string, string | number>;

	constructor(code: string, opts?: { field?: string; context?: Record<string, string | number> }) {
		super(JSON.stringify({ code, field: opts?.field, context: opts?.context }));
		this.name = "AppError";
		this.code = code;
		this.field = opts?.field;
		this.context = opts?.context;
	}
}
