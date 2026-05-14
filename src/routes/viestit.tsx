import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { SITE_NAME } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import { listConversations } from "~/lib/messages";
import { getSession } from "~/lib/session";

export const Route = createFileRoute("/viestit")({
	loader: async () => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/kirjaudu", search: { redirect: undefined } });
		}
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

	return (
		<div className="container mx-auto grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 p-4">
			<aside className="border rounded">
				<h1 className="px-3 py-2 font-semibold border-b">{t("inbox.title")}</h1>
				{conversations.length === 0 ? (
					<p className="px-3 py-2 text-sm text-muted-foreground">{t("inbox.empty")}</p>
				) : (
					<ul>
						{conversations.map((c) => (
							<li key={c.id}>
								<Link
									to="/viestit/$conversationId"
									params={{ conversationId: c.id }}
									className="block px-3 py-2 border-b hover:bg-muted"
									activeProps={{ className: "bg-muted" }}
								>
									<div className="flex items-center justify-between">
										<span className="font-medium truncate">{c.otherPartyDisplayName}</span>
										{c.unreadCount > 0 && (
											<span className="ml-2 rounded-full bg-primary text-primary-foreground text-xs px-2">
												{c.unreadCount}
											</span>
										)}
									</div>
									<div className="text-xs text-muted-foreground truncate">{c.listingTitle}</div>
									<div className="text-sm truncate">{c.lastMessagePreview}</div>
								</Link>
							</li>
						))}
					</ul>
				)}
			</aside>
			<main>
				<Outlet />
			</main>
		</div>
	);
}
