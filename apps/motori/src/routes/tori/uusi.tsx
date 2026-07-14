import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ToriItemForm } from "~/components/tori/tori-item-form";
import { SITE_NAME } from "~/lib/constants";
import { requireSessionOrRedirect } from "~/lib/session";
import { slugify } from "~/lib/slug";
import { createToriItem } from "~/lib/tori/tori-commands";
import type { ToriItemFormData } from "~/lib/tori/validators";

export const Route = createFileRoute("/tori/uusi")({
	loader: async ({ location }) => ({ session: await requireSessionOrRedirect(location.pathname) }),
	head: () => ({
		meta: [{ title: `Uusi ilmoitus — Tori — ${SITE_NAME}` }],
	}),
	component: NewToriItemPage,
});

function NewToriItemPage() {
	const navigate = useNavigate();

	async function handleSubmit(data: ToriItemFormData) {
		const result = await createToriItem({ data });
		const slug = slugify(data.title);
		navigate({
			to: "/tori/$itemId/$slug",
			params: { itemId: result.shortId, slug },
			replace: true,
		});
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-2xl px-4 py-8">
				<div className="mb-8">
					<h1 className="text-2xl font-bold text-primary">Uusi Tori-ilmoitus</h1>
					<p className="mt-1 text-sm text-muted">
						Myy moottoripyörävarusteita, osia tai tarvikkeita.
					</p>
				</div>
				<ToriItemForm onSubmit={handleSubmit} />
			</div>
		</div>
	);
}
