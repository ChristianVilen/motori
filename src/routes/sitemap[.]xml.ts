import { createFileRoute } from "@tanstack/react-router";
import { CATEGORY_BROWSE_PATH } from "~/lib/category-routes";
import { SITE_URL } from "~/lib/constants";
import type { ListingCategory } from "~/lib/db/schema";
import { computeListingSlug, slugify } from "~/lib/slug";

const STATIC_PATHS = [
	{ path: "/", priority: "1.0", changefreq: "daily" },
	{ path: "/pyorat/myynti", priority: "0.9", changefreq: "daily" },
	{ path: "/pyorat/vuokraus", priority: "0.9", changefreq: "daily" },
	{ path: "/varusteet", priority: "0.9", changefreq: "daily" },
	{ path: "/varaosat", priority: "0.9", changefreq: "daily" },
	{ path: "/kayttoehdot", priority: "0.3", changefreq: "yearly" },
	{ path: "/tietosuoja", priority: "0.3", changefreq: "yearly" },
];

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async () => {
				const { db } = await import("~/lib/db/index");
				const listings = await db
					.selectFrom("listing")
					.leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
					.leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
					.select([
						"listing.short_id",
						"listing.category",
						"listing.title",
						"listing.city",
						"listing.updated_at",
						"motorcycle_make.slug as makeSlug",
						"motorcycle_model.name as modelName",
					])
					.where("listing.status", "=", "active")
					.orderBy("listing.updated_at", "desc")
					.limit(50_000)
					.execute();

				const urls = [
					...STATIC_PATHS.map(
						(p) =>
							`<url><loc>${SITE_URL}${p.path}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`,
					),
					...listings.map((l) => {
						const basePath =
							CATEGORY_BROWSE_PATH[l.category as ListingCategory] ?? "/pyorat/vuokraus";
						const slug =
							l.category === "gear" || l.category === "part"
								? slugify(l.title)
								: computeListingSlug(l.makeSlug ?? null, l.modelName ?? null, l.city);
						return `<url><loc>${SITE_URL}${basePath}/${l.short_id}/${slug}</loc><lastmod>${new Date(l.updated_at).toISOString().split("T")[0]}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
					}),
				];

				const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

				return new Response(xml, {
					headers: {
						"Content-Type": "application/xml",
						"Cache-Control": "public, max-age=3600",
					},
				});
			},
		},
	},
});
