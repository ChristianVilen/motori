export function publicSessionUser<T extends { role?: string | null }>(user: T) {
	const { role, ...fields } = user;
	return { ...fields, ...(role === "admin" ? { role } : {}) };
}
