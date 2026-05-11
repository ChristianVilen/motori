import { useState } from "react";
import { useTranslation } from "~/lib/i18n";
import type { ListingImageInput } from "~/lib/validators";

const MAX_IMAGES = 8;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function useImageUpload(initialImages: ListingImageInput[]) {
	const { t } = useTranslation("listings");

	const [existingImages, setExistingImages] = useState<ListingImageInput[]>(initialImages);
	const [pendingFiles, setPendingFiles] = useState<File[]>([]);
	const [imagePreviews, setImagePreviews] = useState<string[]>([]);
	const [imageError, setImageError] = useState<string | null>(null);
	const [uploadProgress, setUploadProgress] = useState<string | null>(null);

	const totalImages = existingImages.length + pendingFiles.length;
	const canAddMore = totalImages < MAX_IMAGES;

	function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
		setImageError(null);
		const files = Array.from(e.target.files ?? []);
		const remaining = MAX_IMAGES - existingImages.length;
		const valid: File[] = [];
		for (const file of files) {
			if (valid.length >= remaining) {
				break;
			}
			if (!ALLOWED_TYPES.includes(file.type)) {
				setImageError(t("form.images.errorInvalidType"));
				continue;
			}
			if (file.size > MAX_FILE_SIZE) {
				setImageError(t("form.images.errorFileTooLarge"));
				continue;
			}
			valid.push(file);
		}
		setPendingFiles((prev) => [...prev, ...valid]);
		for (const file of valid) {
			const reader = new FileReader();
			reader.onload = (ev) => {
				setImagePreviews((prev) => [...prev, ev.target?.result as string]);
			};
			reader.readAsDataURL(file);
		}
		e.target.value = "";
	}

	function removeExistingImage(url: string) {
		setExistingImages((prev) => prev.filter((img) => img.url !== url));
	}

	function removePendingImage(index: number) {
		setPendingFiles((prev) => prev.filter((_, i) => i !== index));
		setImagePreviews((prev) => prev.filter((_, i) => i !== index));
	}

	async function uploadFiles(): Promise<ListingImageInput[]> {
		const results: ListingImageInput[] = [];
		for (let i = 0; i < pendingFiles.length; i++) {
			setUploadProgress(t("form.images.uploading", { current: i + 1, total: pendingFiles.length }));
			const body = new FormData();
			body.append("file", pendingFiles[i]);
			const res = await fetch("/api/images/upload", { method: "POST", body });
			if (!res.ok) {
				const err = await res.json().catch(() => ({ error: "Kuvan lataus epäonnistui" }));
				throw new Error((err as { error: string }).error);
			}
			const { url, thumbnailUrl } = (await res.json()) as { url: string; thumbnailUrl: string };
			results.push({ url, thumbnail_url: thumbnailUrl });
		}
		setUploadProgress(null);
		return [...existingImages, ...results];
	}

	return {
		existingImages,
		pendingFiles,
		imagePreviews,
		imageError,
		uploadProgress,
		totalImages,
		canAddMore,
		maxImages: MAX_IMAGES,
		handleFileSelect,
		removeExistingImage,
		removePendingImage,
		uploadFiles,
	};
}
