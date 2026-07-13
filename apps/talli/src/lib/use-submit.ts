import { useState } from "react";
import { toast } from "sonner";
import { formErrorMessage } from "~/lib/errors";

/**
 * Wraps a form submit: sets a `saving` flag, runs `fn`, toasts a user-safe message
 * on failure, and always clears `saving` in a `finally`. Every talli form uses this
 * so the saving/error handling can't drift (and the reset can't be forgotten on one
 * path but not another).
 */
export function useSubmit() {
	const [saving, setSaving] = useState(false);
	async function submit(fn: () => Promise<void>) {
		setSaving(true);
		try {
			await fn();
		} catch (err) {
			toast.error(formErrorMessage(err));
		} finally {
			setSaving(false);
		}
	}
	return { saving, submit };
}
