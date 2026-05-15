import { createFileRoute, Link } from "@tanstack/react-router";
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
		if (!body.trim() || sending || conv.readOnly) {
			return;
		}
		setSending(true);
		try {
			await sendMessage({ data: { conversationId: params.conversationId, body } });
			setBody("");
		} finally {
			setSending(false);
		}
	};

	const initials = conv.otherParty.displayName.charAt(0).toUpperCase();

	return (
		<div className="flex flex-col h-full">
			<header className="flex items-center gap-3 px-3 py-2.5 border-b border-border bg-card shrink-0">
				{/* Back button — mobile only */}
				<Link
					to="/viestit"
					className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg text-muted hover:text-foreground hover:bg-muted-light transition-colors shrink-0"
					aria-label="Takaisin"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						role="img"
						aria-label="Takaisin"
					>
						<path d="m15 18-6-6 6-6" />
					</svg>
				</Link>

				<div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-medium text-sm text-primary shrink-0">
					{initials}
				</div>
				<div className="min-w-0 flex-1">
					<h2 className="font-semibold text-sm text-foreground leading-tight truncate">
						{conv.otherParty.displayName}
					</h2>
					<p className="text-xs text-muted truncate">{conv.listing.title}</p>
				</div>
			</header>

			<div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2">
				{messages.map((m, i) => (
					<MessageBubble
						key={m.id}
						message={m}
						mine={m.sender_id !== conv.otherParty.id}
						index={i}
					/>
				))}
				<div ref={bottomRef} />
			</div>

			{conv.readOnly ? (
				<div className="px-4 py-3 border-t border-border text-xs text-muted bg-muted-light/50 text-center shrink-0">
					{t("thread.readOnly")}
				</div>
			) : (
				<div className="px-4 py-3 border-t border-border bg-card flex gap-2 items-end shrink-0">
					<textarea
						value={body}
						onChange={(e) => setBody(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								onSend();
							}
						}}
						maxLength={4000}
						rows={2}
						className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
						placeholder={t("thread.placeholder")}
					/>
					<button
						type="button"
						onClick={onSend}
						disabled={sending}
						className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors shrink-0"
					>
						{t("thread.send")}
					</button>
				</div>
			)}
		</div>
	);
}

function MessageBubble({
	message,
	mine,
	index,
}: {
	message: Message;
	mine: boolean;
	index: number;
}) {
	if (message.kind === "booking_request") {
		return (
			<div
				className="flex justify-center my-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
				style={{ animationDelay: `${Math.min(index * 30, 300)}ms`, animationFillMode: "both" }}
			>
				<div className="bg-muted-light text-muted text-xs rounded-full px-4 py-1.5 max-w-sm text-center">
					{message.body}
				</div>
			</div>
		);
	}
	return (
		<div
			className={`flex animate-in fade-in duration-200 ${mine ? "justify-end slide-in-from-right-2" : "justify-start slide-in-from-left-2"}`}
			style={{ animationDelay: `${Math.min(index * 30, 300)}ms`, animationFillMode: "both" }}
		>
			<div
				className={`max-w-[75%] sm:max-w-[65%] px-4 py-2.5 text-sm leading-relaxed ${
					mine
						? "bg-accent text-white rounded-2xl rounded-br-sm"
						: "bg-muted-light text-foreground rounded-2xl rounded-bl-sm"
				}`}
			>
				<p className="whitespace-pre-wrap break-words">{message.body}</p>
			</div>
		</div>
	);
}
