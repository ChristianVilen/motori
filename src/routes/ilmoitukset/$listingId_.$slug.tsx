import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { categoryBrowsePath } from "~/lib/category-routes";
import type { ListingCategory } from "~/lib/db/schema";
import { computeCategorySlug } from "~/lib/slug";

export const Route = createFileRoute("/ilmoitukset/$listingId_/$slug")({
	loader: async ({ params }) => {
		const { db } = await import("~/lib/db/index");
		const row = await db
			.selectFrom("listing")
			.leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
			.leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
			.select([
				"listing.short_id",
				"listing.category",
				"listing.title",
				"listing.city",
				"motorcycle_make.slug as makeSlug",
				"motorcycle_model.name as modelName",
			])
			.where("listing.short_id", "=", params.listingId)
			.where("listing.status", "!=", "removed")
			.executeTakeFirst();

		if (!row) {
			throw notFound();
		}

		const slug = computeCategorySlug(
			row.category,
			row.title,
			row.makeSlug ?? null,
			row.modelName ?? null,
			row.city,
		);

		throw redirect({
			href: `${categoryBrowsePath(row.category as ListingCategory)}/${row.short_id}/${slug}`,
			statusCode: 301,
			replace: true,
		});
	},
	component: () => null,
});
