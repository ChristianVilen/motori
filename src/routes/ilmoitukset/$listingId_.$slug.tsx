import { createFileRoute, redirect } from "@tanstack/react-router";
import { categoryBrowsePath } from "~/lib/category-routes";
import type { ListingCategory } from "~/lib/db/schema";
import { computeListingSlug } from "~/lib/slug";

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
        "listing.city",
        "motorcycle_make.slug as makeSlug",
        "motorcycle_model.name as modelName",
      ])
      .where("listing.short_id", "=", params.listingId)
      .where("listing.status", "!=", "removed")
      .executeTakeFirst();

    if (!row) return;

    const slug = computeListingSlug(row.makeSlug ?? null, row.modelName ?? null, row.city);

    throw redirect({
      href: `${categoryBrowsePath(row.category as ListingCategory)}/${row.short_id}/${slug}`,
      statusCode: 301,
      replace: true,
    });
  },
  component: () => null,
});
