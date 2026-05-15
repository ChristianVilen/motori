import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth";
import { getConversationServer } from "~/lib/messages.server";
import { subscribe } from "~/lib/messages-bus";

export const Route = createFileRoute("/api/messages/stream/$conversationId")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const session = await auth.api.getSession({ headers: request.headers });
				if (!session) {
					return new Response("Unauthorized", { status: 401 });
				}

				try {
					await getConversationServer({
						conversationId: params.conversationId,
						userId: session.user.id,
					});
				} catch {
					return new Response("Forbidden", { status: 403 });
				}

				const encoder = new TextEncoder();
				const stream = new ReadableStream({
					start(controller) {
						const send = (data: unknown) =>
							controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
						const heartbeat = setInterval(
							() => controller.enqueue(encoder.encode(`: hb\n\n`)),
							25_000,
						);
						const unsub = subscribe(params.conversationId, (msg) => send(msg));
						const abort = () => {
							clearInterval(heartbeat);
							unsub();
							try {
								controller.close();
							} catch {
								/* already closed */
							}
						};
						request.signal.addEventListener("abort", abort);
					},
				});

				return new Response(stream, {
					headers: {
						"content-type": "text/event-stream",
						"cache-control": "no-cache, no-transform",
						connection: "keep-alive",
					},
				});
			},
		},
	},
});
