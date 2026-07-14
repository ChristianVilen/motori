import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { SITE_NAME } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import { listConversations } from "~/lib/messages";
import { requireSessionOrRedirect } from "~/lib/session";

export const Route = createFileRoute("/viestit")({
	loader: async () => {
		await requireSessionOrRedirect();
		return await listConversations();
	},
	head: () => ({
		meta: [{ title: `Viestit — ${SITE_NAME}` }],
	}),
	component: ViestitLayout,
});

function ViestitLayout() {
	const conversations = Route.useLoaderData();
	const { t } = useTranslation("messages");
	const location = useLocation();
	const inThread = location.pathname !== "/viestit";

	return (
		<div className="flex h-[calc(100dvh-120px)] md:h-[calc(100dvh-56px)] max-w-5xl mx-auto md:border-x border-border">
			<aside
				className={`w-full md:w-72 md:shrink-0 h-full border-r border-border bg-card flex-col ${
					inThread ? "hidden md:flex" : "flex"
				}`}
			>
				<h1 className="px-4 py-3 font-heading font-semibold text-sm border-b border-border text-foreground shrink-0">
					{t("inbox.title")}
				</h1>
				{conversations.length === 0 ? (
					<p className="px-4 py-8 text-sm text-muted text-center">{t("inbox.empty")}</p>
				) : (
					<ul className="flex-1 overflow-y-auto">
						{conversations.map((c) => (
							<li key={c.id}>
								<Link
									to="/viestit/$conversationId"
									params={{ conversationId: c.id }}
									className="flex items-start gap-3 px-4 py-3 border-b border-border hover:bg-muted-light transition-colors border-l-2 border-l-transparent"
									activeProps={{ className: "bg-muted-light border-l-2 border-l-accent" }}
								>
									<div className="flex-1 min-w-0">
										<div className="flex items-center justify-between gap-2">
											<span className="font-medium text-sm text-foreground truncate">
												{c.otherPartyDisplayName}
											</span>
											{c.unreadCount > 0 ? (
												<span className="shrink-0 rounded-full bg-accent text-white text-xs px-1.5 py-0.5 leading-none">
													{c.unreadCount}
												</span>
											) : null}
										</div>
										<div className="text-xs text-muted truncate mt-0.5">{c.listingTitle}</div>
										{c.lastMessagePreview ? (
											<div className="text-xs text-muted-foreground truncate mt-0.5">
												{c.lastMessagePreview}
											</div>
										) : null}
									</div>
								</Link>
							</li>
						))}
					</ul>
				)}
			</aside>

			<main
				className={`${
					inThread ? "flex" : "hidden md:flex"
				} flex-1 min-w-0 h-full bg-background flex-col`}
			>
				<Outlet />
			</main>
		</div>
	);
}
