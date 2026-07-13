import { useState } from "react";
import { toast } from "sonner";
import { type UploadedPhoto, uploadPhoto } from "~/components/photo-upload";
import { formErrorMessage } from "~/lib/errors";

/**
 * Wraps a single image upload: `uploading` flag + user-safe error toast, returning
 * the uploaded photo (or null on failure/no-file). The caller decides how to store
 * it — a single photo replaces, a gallery appends — so this stays a thin wrapper
 * over the upload+error handling rather than a form model the two UIs would fight.
 */
export function usePhotoUpload() {
	const [uploading, setUploading] = useState(false);
	async function upload(file: File | undefined): Promise<UploadedPhoto | null> {
		if (!file) {
			return null;
		}
		setUploading(true);
		try {
			return await uploadPhoto(file);
		} catch (err) {
			toast.error(formErrorMessage(err));
			return null;
		} finally {
			setUploading(false);
		}
	}
	return { uploading, upload };
}
