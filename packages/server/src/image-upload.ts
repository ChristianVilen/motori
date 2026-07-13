import { optimizeAndUpload } from "./image-storage";
import { checkRateLimit, getClientIp } from "./rate-limit";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function jsonError(error: string, status: number) {
	return new Response(JSON.stringify({ error }), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

interface UploadedInfo {
	key: string;
	originalSize: number;
	optimizedSize: number;
}

export interface ImageUploadConfig {
	/** Resolves the BetterAuth session from the request headers. */
	getSession: (
		headers: Headers,
	) => Promise<{ user: { id: string; emailVerified: boolean } } | null>;
	/** Storage key namespace, e.g. "listings" or "talli". */
	keyPrefix: string;
	/** Rate-limit bucket prefix, e.g. "image-upload" or "talli-image-upload". */
	rateLimitPrefix: string;
	/** The origin the request's Origin header must match (CSRF). */
	expectedOrigin: string;
	maxBytes: number;
	/** App-specific side effect (logging) after a successful upload. */
	onUploaded?: (info: UploadedInfo) => void;
}

/**
 * Shared POST handler for `/api/images/upload`: auth → verify → CSRF → rate limit
 * → multipart parse → sharp optimize → store. Each app keeps a thin
 * `createFileRoute` shell and passes its own key/rate/origin/log config, so the
 * security-sensitive flow lives in one place and can't drift between apps.
 */
export async function handleImageUpload(
	request: Request,
	config: ImageUploadConfig,
): Promise<Response> {
	const session = await config.getSession(request.headers);
	if (!session) {
		return jsonError("Kirjaudu sisään", 401);
	}
	if (!session.user.emailVerified) {
		return jsonError("Vahvista sähköpostiosoitteesi ensin", 403);
	}

	const origin = request.headers.get("origin");
	if (!origin || origin !== config.expectedOrigin) {
		return jsonError("CSRF validation failed", 403);
	}

	const ip = getClientIp(request);
	if (ip) {
		const { allowed, retryAfter } = checkRateLimit(`${config.rateLimitPrefix}:${ip}`, 20, 60_000);
		if (!allowed) {
			return new Response(
				JSON.stringify({ error: `Liian monta latausta. Yritä ${retryAfter}s kuluttua.` }),
				{
					status: 429,
					headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) },
				},
			);
		}
	}

	const formData = await request.formData();
	const file = formData.get("file");
	if (!(file instanceof File)) {
		return jsonError("Tiedosto puuttuu", 400);
	}
	if (!ALLOWED_TYPES.has(file.type)) {
		return jsonError("Vain JPEG, PNG ja WebP sallittu", 400);
	}
	if (file.size > config.maxBytes) {
		return jsonError(
			`Tiedosto on liian suuri (max ${Math.round(config.maxBytes / 1024 / 1024)} MB)`,
			400,
		);
	}

	const raw = Buffer.from(await file.arrayBuffer());
	const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
	const key = `${config.keyPrefix}/${session.user.id}/${id}.webp`;
	const thumbKey = `${config.keyPrefix}/${session.user.id}/${id}_thumb.webp`;

	const { url, thumbnailUrl, optimizedSize } = await optimizeAndUpload(raw, key, thumbKey);

	config.onUploaded?.({ key, originalSize: file.size, optimizedSize });

	return new Response(JSON.stringify({ url, thumbnailUrl }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}
