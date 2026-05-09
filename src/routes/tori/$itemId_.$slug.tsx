import { createFileRoute, redirect } from "@tanstack/react-router";
import { computeListingSlug, slugify } from "~/lib/slug";

const CATEGORY_PATH: Record<string, string> = {
  rental: "/pyorat/vuokraus",
  sale: "/pyorat/myynti",
  gear: "/varusteet",
  part: "/varaosat",
};

export const Route = createFileRoute("/tori/$itemId_/$slug")({
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
      .where("listing.short_id", "=", params.itemId)
      .where("listing.status", "!=", "removed")
      .executeTakeFirst();

    if (!row) return;

    const basePath = CATEGORY_PATH[row.category] ?? "/varusteet";
    const slug =
      row.category === "gear" || row.category === "part"
        ? slugify(row.title)
        : computeListingSlug(row.makeSlug ?? null, row.modelName ?? null, row.city);

    throw redirect({
      href: `${basePath}/${row.short_id}/${slug}`,
      statusCode: 301,
      replace: true,
    });
  },
  component: () => null,
});
