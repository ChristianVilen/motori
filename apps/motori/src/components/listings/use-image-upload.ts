import { useState } from "react";
import { MAX_IMAGE_UPLOAD_BYTES } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import type { ListingImageInput } from "~/lib/validators";

const MAX_IMAGES = 8;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type ImageItem =
	| { key: string; kind: "existing"; url: string; thumbnailUrl: string | null }
	| { key: string; kind: "pending"; file: File; preview: string };

function newKey() {
	return Math.random().toString(36).slice(2);
}

// Pending files have no URL yet; the placeholder passes listingImageSchema so
// pre-upload validation counts them toward the image requirement.
const PENDING_IMAGE_URL = "https://pending.invalid/upload";

export function provisionalImages(items: ImageItem[]): ListingImageInput[] {
	return items.map((it) =>
		it.kind === "existing"
			? { url: it.url, thumbnail_url: it.thumbnailUrl }
			: { url: PENDING_IMAGE_URL, thumbnail_url: null },
	);
}

export function useImageUpload(initialImages: ListingImageInput[]) {
	const { t } = useTranslation("listings");

	const [items, setItems] = useState<ImageItem[]>(() =>
		initialImages.map((img) => ({
			key: newKey(),
			kind: "existing" as const,
			url: img.url,
			thumbnailUrl: img.thumbnail_url ?? null,
		})),
	);
	const [imageError, setImageError] = useState<string | null>(null);
	const [uploadProgress, setUploadProgress] = useState<string | null>(null);

	const totalImages = items.length;
	const canAddMore = totalImages < MAX_IMAGES;

	function addFiles(files: File[]) {
		setImageError(null);
		const remaining = MAX_IMAGES - items.length;
		const valid: File[] = [];
		for (const file of files) {
			if (valid.length >= remaining) {
				break;
			}
			if (!ALLOWED_TYPES.includes(file.type)) {
				setImageError(t("form.images.errorInvalidType"));
				continue;
			}
			if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
				setImageError(t("form.images.errorFileTooLarge"));
				continue;
			}
			valid.push(file);
		}
		for (const file of valid) {
			const reader = new FileReader();
			const key = newKey();
			reader.onload = (ev) => {
				const preview = ev.target?.result as string;
				setItems((prev) => [...prev, { key, kind: "pending", file, preview }]);
			};
			reader.readAsDataURL(file);
		}
	}

	function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
		addFiles(Array.from(e.target.files ?? []));
		e.target.value = "";
	}

	function handleFileDrop(e: React.DragEvent) {
		e.preventDefault();
		addFiles(Array.from(e.dataTransfer.files));
	}

	function removeItem(key: string) {
		setItems((prev) => prev.filter((it) => it.key !== key));
	}

	function moveItem(key: string, direction: -1 | 1) {
		setItems((prev) => {
			const i = prev.findIndex((it) => it.key === key);
			const j = i + direction;
			if (i < 0 || j < 0 || j >= prev.length) {
				return prev;
			}
			const next = prev.slice();
			[next[i], next[j]] = [next[j], next[i]];
			return next;
		});
	}

	function setAsCover(key: string) {
		setItems((prev) => {
			const i = prev.findIndex((it) => it.key === key);
			if (i <= 0) {
				return prev;
			}
			const next = prev.slice();
			const [item] = next.splice(i, 1);
			next.unshift(item);
			return next;
		});
	}

	async function uploadFiles(): Promise<ListingImageInput[]> {
		const pendings = items.filter((it) => it.kind === "pending") as Extract<
			ImageItem,
			{ kind: "pending" }
		>[];
		const uploaded = new Map<string, ListingImageInput>();
		try {
			for (let i = 0; i < pendings.length; i++) {
				setUploadProgress(t("form.images.uploading", { current: i + 1, total: pendings.length }));
				const body = new FormData();
				body.append("file", pendings[i].file);
				const res = await fetch("/api/images/upload", { method: "POST", body });
				if (!res.ok) {
					const err = await res.json().catch(() => ({ error: "Kuvan lataus epäonnistui" }));
					throw new Error((err as { error: string }).error);
				}
				const { url, thumbnailUrl } = (await res.json()) as { url: string; thumbnailUrl: string };
				uploaded.set(pendings[i].key, { url, thumbnail_url: thumbnailUrl });
				// Mark done immediately so a later failure never re-uploads this file.
				const key = pendings[i].key;
				setItems((prev) =>
					prev.map((it) => (it.key === key ? { key, kind: "existing", url, thumbnailUrl } : it)),
				);
			}
		} finally {
			setUploadProgress(null);
		}
		return items.map((it) => {
			if (it.kind === "existing") {
				return { url: it.url, thumbnail_url: it.thumbnailUrl };
			}
			const u = uploaded.get(it.key);
			if (!u) {
				throw new Error("Upload result missing");
			}
			return u;
		});
	}

	return {
		items,
		imageError,
		uploadProgress,
		totalImages,
		canAddMore,
		maxImages: MAX_IMAGES,
		handleFileSelect,
		handleFileDrop,
		removeItem,
		moveItem,
		setAsCover,
		uploadFiles,
	};
}
