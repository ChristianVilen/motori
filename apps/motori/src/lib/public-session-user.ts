export function publicSessionUser<T extends { role?: string | null }>(user: T) {
	const { role, ...fields } = user;
	return { ...fields, ...(role === "admin" ? { role } : {}) };
}

export async function publicAuthResponse(response: Response): Promise<Response> {
	let payload: { user?: { role?: string | null } } | null;
	try {
		payload = await response.clone().json();
	} catch {
		return response;
	}
	if (!payload?.user || !("role" in payload.user) || payload.user.role === "admin") {
		return response;
	}
	const headers = new Headers(response.headers);
	headers.delete("content-length");
	headers.delete("etag");
	return Response.json(
		{ ...payload, user: publicSessionUser(payload.user) },
		{ status: response.status, headers },
	);
}
