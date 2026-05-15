import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Message } from "~/lib/db/schema";
import { useTranslation } from "~/lib/i18n";
import { getConversation, listMessages, markRead, sendMessage } from "~/lib/messages";

export const Route = createFileRoute("/viestit/$conversationId")({
	loader: async ({ params }) => {
		const [conv, page] = await Promise.all([
			getConversation({ data: { conversationId: params.conversationId } }),
			listMessages({ data: { conversationId: params.conversationId } }),
		]);
		await markRead({ data: { conversationId: params.conversationId } });
		return { conv, initialMessages: page.messages };
	},
	component: ThreadPage,
});

function ThreadPage() {
	const params = Route.useParams();
	const { conv, initialMessages } = Route.useLoaderData();
	const [messages, setMessages] = useState<Message[]>(initialMessages);
	const [body, setBody] = useState("");
	const [sending, setSending] = useState(false);
	const bottomRef = useRef<HTMLDivElement | null>(null);
	const prevLengthRef = useRef(messages.length);
	const { t } = useTranslation("messages");

	useEffect(() => {
		const es = new EventSource(`/api/messages/stream/${params.conversationId}`);
		es.onmessage = (ev) => {
			const msg = JSON.parse(ev.data) as Message;
			setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
		};
		return () => es.close();
	}, [params.conversationId]);

	useEffect(() => {
		if (messages.length !== prevLengthRef.current) {
			prevLengthRef.current = messages.length;
			bottomRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages]);

	const onSend = async () => {
		if (!body.trim() || sending || conv.readOnly) return;
		setSending(true);
		try {
			await sendMessage({ data: { conversationId: params.conversationId, body } });
			setBody("");
		} finally {
			setSending(false);
		}
	};

	return (
		<div className="flex flex-col h-[calc(100vh-8rem)] border rounded">
			<header className="border-b p-3">
				<h2 className="font-semibold">{conv.otherParty.displayName}</h2>
				<p className="text-xs text-muted-foreground">{conv.listing.title}</p>
			</header>
			<div className="flex-1 overflow-y-auto p-3 space-y-2">
				{messages.map((m) => (
					<MessageBubble key={m.id} message={m} mine={m.sender_id !== conv.otherParty.id} />
				))}
				<div ref={bottomRef} />
			</div>
			{conv.readOnly ? (
				<div className="border-t p-3 text-sm text-muted-foreground">{t("thread.readOnly")}</div>
			) : (
				<div className="border-t p-3 flex gap-2">
					<textarea
						value={body}
						onChange={(e) => setBody(e.target.value)}
						maxLength={4000}
						rows={2}
						className="flex-1 border rounded p-2"
						placeholder={t("thread.placeholder")}
					/>
					<button
						type="button"
						onClick={onSend}
						disabled={sending}
						className="px-4 rounded bg-primary text-primary-foreground disabled:opacity-50"
					>
						{t("thread.send")}
					</button>
				</div>
			)}
		</div>
	);
}

function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
	if (message.kind === "booking_request") {
		return (
			<div className="text-center text-xs text-muted-foreground border-y py-2">
				<span className="whitespace-pre-wrap">{message.body}</span>
			</div>
		);
	}
	return (
		<div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
			<div
				className={`max-w-[70%] rounded-lg px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}
			>
				<p className="whitespace-pre-wrap break-words">{message.body}</p>
			</div>
		</div>
	);
}
