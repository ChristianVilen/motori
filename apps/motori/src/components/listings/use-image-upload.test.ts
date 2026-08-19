// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ChangeEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ListingImageInput } from "~/lib/validators";
import { listingImageSchema } from "~/lib/validators";
import type { ImageItem } from "./use-image-upload";
import { provisionalImages, useImageUpload } from "./use-image-upload";

vi.mock("~/lib/i18n", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

type Hook = { current: ReturnType<typeof useImageUpload> };

function selectFile(result: Hook, file: File) {
	act(() => {
		result.current.handleFileSelect({
			target: { files: [file], value: "" },
		} as unknown as ChangeEvent<HTMLInputElement>);
	});
}

function okResponse(url: string): Response {
	return {
		ok: true,
		json: async () => ({ url, thumbnailUrl: `${url}?thumb` }),
	} as Response;
}

describe("useImageUpload", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("keeps successful uploads so a retry only re-uploads the failed files", async () => {
		const { result } = renderHook(() => useImageUpload([]));

		selectFile(result, new File(["a"], "a.jpg", { type: "image/jpeg" }));
		await waitFor(() => expect(result.current.items).toHaveLength(1));
		selectFile(result, new File(["b"], "b.png", { type: "image/png" }));
		await waitFor(() => expect(result.current.items).toHaveLength(2));

		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(okResponse("https://cdn.example/a.webp"))
			.mockRejectedValueOnce(new Error("network down"));
		vi.stubGlobal("fetch", fetchMock);

		await act(async () => {
			await expect(result.current.uploadFiles()).rejects.toThrow("network down");
		});

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(result.current.items[0]).toMatchObject({
			kind: "existing",
			url: "https://cdn.example/a.webp",
			thumbnailUrl: "https://cdn.example/a.webp?thumb",
		});
		expect(result.current.items[1]).toMatchObject({ kind: "pending" });

		fetchMock.mockResolvedValue(okResponse("https://cdn.example/b.webp"));
		let uploaded: ListingImageInput[] = [];
		await act(async () => {
			uploaded = await result.current.uploadFiles();
		});

		expect(fetchMock).toHaveBeenCalledTimes(3);
		const retryBody = fetchMock.mock.calls[2][1]?.body as FormData;
		expect((retryBody.get("file") as File).name).toBe("b.png");
		expect(uploaded).toEqual([
			{ url: "https://cdn.example/a.webp", thumbnail_url: "https://cdn.example/a.webp?thumb" },
			{ url: "https://cdn.example/b.webp", thumbnail_url: "https://cdn.example/b.webp?thumb" },
		]);
	});
});

describe("provisionalImages", () => {
	it("maps existing items to real urls and pending items to a schema-passing placeholder", () => {
		const items: ImageItem[] = [
			{ key: "1", kind: "existing", url: "https://cdn.example/a.webp", thumbnailUrl: null },
			{
				key: "2",
				kind: "pending",
				file: new File(["b"], "b.png", { type: "image/png" }),
				preview: "data:image/png;base64,",
			},
		];
		const out = provisionalImages(items);
		expect(out).toHaveLength(2);
		expect(out[0]).toEqual({ url: "https://cdn.example/a.webp", thumbnail_url: null });
		expect(listingImageSchema().safeParse(out[1]).success).toBe(true);
	});
});
