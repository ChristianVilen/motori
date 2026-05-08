import { createFileRoute, Link, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { ToriItemForm } from "~/components/tori/tori-item-form";
import { centsToEuros } from "~/lib/currency";
import { AppError } from "~/lib/errors";
import { getSession } from "~/lib/session";
import { slugify } from "~/lib/slug";
import { updateToriItem } from "~/lib/tori/tori-commands";
import type { ToriItemFormData } from "~/lib/tori/validators";

const getDb = async () => (await import("~/lib/db/index")).db;

const getToriItemForEdit = createServerFn({ method: "GET" })
	.inputValidator((shortId: string) => shortId)
	.handler(async ({ data: shortId }) => {
		const session = await getSession();
		if (!session) {
			throw new AppError("auth.unauthorized");
		}

		const db = await getDb();
		const item = await db
			.selectFrom("tori_item")
			.selectAll()
			.where("short_id", "=", shortId)
			.executeTakeFirst();

		if (!item || item.owner_id !== session.user.id) {
			return null;
		}

		const images = await db
			.selectFrom("tori_item_image")
			.selectAll()
			.where("item_id", "=", item.id)
			.orderBy("order", "asc")
			.execute();

		return { item, images };
	});

export const Route = createFileRoute("/tori/$itemId_/muokkaa")({
	loader: async ({ params }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/kirjaudu", search: { redirect: undefined } });
		}
		const result = await getToriItemForEdit({ data: params.itemId });
		if (!result) {
			throw notFound();
		}
		return result;
	},
	component: EditToriItemPage,
	notFoundComponent: () => (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4">
			<p className="text-muted">Ilmoitusta ei löytynyt tai sinulla ei ole oikeutta muokata sitä.</p>
			<Link to="/tori" className="text-sm text-accent underline">
				Takaisin Torille
			</Link>
		</div>
	),
});

function EditToriItemPage() {
	const { item, images } = Route.useLoaderData();
	const navigate = useNavigate();

	const initialValues: Partial<ToriItemFormData> = {
		title: item.title,
		category: item.category,
		condition: item.condition,
		price: centsToEuros(item.price_cents),
		description: item.description,
		city: item.city,
		region: item.region,
		postal_code: item.postal_code ?? "",
	};

	const initialImages = images.map((img) => ({
		url: img.url,
		thumbnail_url: img.thumbnail_url,
	}));

	async function handleSubmit(data: ToriItemFormData) {
		await updateToriItem({ data: { id: item.id, data } });
		const slug = slugify(item.title);
		navigate({
			to: "/tori/$itemId/$slug",
			params: { itemId: item.short_id, slug },
			replace: true,
		});
	}

	const slug = slugify(item.title);

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-2xl px-4 py-8">
				<div className="mb-8">
					<Link
						to="/tori/$itemId/$slug"
						params={{ itemId: item.short_id, slug }}
						className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-foreground"
					>
						<ArrowLeft className="h-4 w-4" />
						Takaisin ilmoitukseen
					</Link>
					<h1 className="text-2xl font-bold text-primary">Muokkaa ilmoitusta</h1>
					<p className="mt-1 text-sm text-muted">{item.title}</p>
				</div>
				<ToriItemForm
					initialValues={initialValues}
					initialImages={initialImages}
					onSubmit={handleSubmit}
					submitLabel="Tallenna muutokset"
				/>
			</div>
		</div>
	);
}
