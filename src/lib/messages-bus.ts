/**
 * In-memory pub/sub keyed by conversation_id.
 * SINGLE-PROCESS ONLY: subscribers in another Node instance won't see publishes.
 * Replace with Postgres LISTEN/NOTIFY before horizontal scaling.
 */
import type { Message } from "~/lib/db/schema";

type Subscriber = (msg: Message) => void;

const channels = new Map<string, Set<Subscriber>>();

export function subscribe(conversationId: string, fn: Subscriber): () => void {
	let set = channels.get(conversationId);
	if (!set) {
		set = new Set();
		channels.set(conversationId, set);
	}
	set.add(fn);
	return () => {
		const s = channels.get(conversationId);
		if (!s) return;
		s.delete(fn);
		if (s.size === 0) channels.delete(conversationId);
	};
}

export function publish(conversationId: string, msg: Message): void {
	const set = channels.get(conversationId);
	if (!set) return;
	for (const fn of set) {
		try {
			fn(msg);
		} catch {
			// subscriber error must not break other subscribers
		}
	}
}
