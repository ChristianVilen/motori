import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { sql } from "kysely";
import { requireAdmin } from "~/lib/admin";
import { csrfMiddleware } from "~/lib/csrf";
import { db } from "~/lib/db/index";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { requireVerifiedEmail } from "~/lib/require-verified-email";
import { getSession } from "~/lib/session";

const REASON_MAX = 1000;
const PAGE_SIZE = 25;

export const submitReport = createServerFn({ method: "POST" })
	.middleware([
		csrfMiddleware(),
		rateLimitMiddleware(5, 60, "submit-report"),
		requireVerifiedEmail(),
	])
	.inputValidator((input: { targetType: "listing" | "user"; targetId: string; reason: string }) => {
		if (!["listing", "user"].includes(input.targetType)) {
			throw new Error("Invalid target type");
		}
		if (!input.targetId) {
			throw new Error("Missing target");
		}
		if (!input.reason || input.reason.length > REASON_MAX) {
			throw new Error("Invalid reason");
		}
		return input;
	})
	.handler(async ({ data }) => {
		// Session guaranteed by requireVerifiedEmail middleware
		const session = await getSession();
		if (!session) {
			throw new Error("UNAUTHORIZED");
		}

		// Can't report yourself
		if (data.targetType === "user" && data.targetId === session.user.id) {
			setResponseStatus(400);
			throw new Error("CANNOT_REPORT_SELF");
		}

		// Validate target exists and check ownership
		if (data.targetType === "listing") {
			const listing = await db
				.selectFrom("listing")
				.select("owner_id")
				.where("id", "=", data.targetId)
				.executeTakeFirst();
			if (!listing) {
				setResponseStatus(404);
				throw new Error("TARGET_NOT_FOUND");
			}
			if (listing.owner_id === session.user.id) {
				setResponseStatus(400);
				throw new Error("CANNOT_REPORT_OWN");
			}
		} else {
			const user = await db
				.selectFrom("user")
				.select("id")
				.where("id", "=", data.targetId)
				.executeTakeFirst();
			if (!user) {
				setResponseStatus(404);
				throw new Error("TARGET_NOT_FOUND");
			}
		}

		const id = crypto.randomUUID();
		try {
			await db
				.insertInto("report")
				.values({
					id,
					reporter_id: session.user.id,
					target_type: data.targetType,
					target_id: data.targetId,
					reason: data.reason.slice(0, REASON_MAX),
				})
				.execute();
		} catch (e: unknown) {
			if ((e as { code?: string }).code === "23505") {
				setResponseStatus(409);
				throw new Error("ALREADY_REPORTED");
			}
			throw e;
		}

		return { ok: true };
	});

const VALID_REPORT_STATUSES = ["pending", "resolved", "dismissed", "all"] as const;

export const getReports = createServerFn({ method: "GET" })
	.inputValidator((input: { status?: string; page?: number }) => {
		if (input.status && !VALID_REPORT_STATUSES.includes(input.status as never)) {
			throw new Error("Invalid status");
		}
		return input;
	})
	.handler(async ({ data }) => {
		await requireAdmin();

		const page = data.page ?? 1;
		const offset = (page - 1) * PAGE_SIZE;
		const status = data.status ?? "pending";

		let query = db
			.selectFrom("report")
			.innerJoin("user as reporter", "reporter.id", "report.reporter_id")
			.leftJoin("listing", (join) =>
				join.onRef("listing.id", "=", "report.target_id").on("report.target_type", "=", "listing"),
			)
			.leftJoin("motorcycle_make", (join) =>
				join
					.onRef("motorcycle_make.id", "=", "listing.make_id")
					.on("report.target_type", "=", "listing"),
			)
			.leftJoin("motorcycle_model", (join) =>
				join
					.onRef("motorcycle_model.id", "=", "listing.model_id")
					.on("report.target_type", "=", "listing"),
			)
			.leftJoin("user as target_user", (join) =>
				join.onRef("target_user.id", "=", "report.target_id").on("report.target_type", "=", "user"),
			)
			.select([
				"report.id",
				"report.target_type",
				"report.target_id",
				"report.reason",
				"report.status",
				"report.admin_note",
				"report.created_at",
				"reporter.name as reporterName",
				sql<string | null>`coalesce(listing.title, target_user.name)`.as("targetName"),
				sql<string | null>`listing.short_id`.as("listingShortId"),
				sql<string | null>`listing.city`.as("listingCity"),
				sql<string | null>`motorcycle_make.slug`.as("listingMakeSlug"),
				sql<string | null>`motorcycle_model.name`.as("listingModelName"),
			]);

		if (status !== "all") {
			query = query.where("report.status", "=", status as "pending" | "resolved" | "dismissed");
		}

		const [rows, countResult] = await Promise.all([
			query.orderBy("report.created_at", "desc").limit(PAGE_SIZE).offset(offset).execute(),
			db
				.selectFrom("report")
				.select(sql<number>`count(*)::int`.as("total"))
				.$if(status !== "all", (qb) =>
					qb.where("status", "=", status as "pending" | "resolved" | "dismissed"),
				)
				.executeTakeFirstOrThrow(),
		]);

		return {
			reports: rows,
			total: countResult.total,
			page,
			totalPages: Math.ceil(countResult.total / PAGE_SIZE),
		};
	});

export const resolveReport = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware()])
	.inputValidator(
		(input: { reportId: string; status: "resolved" | "dismissed"; adminNote?: string }) => {
			if (!["resolved", "dismissed"].includes(input.status)) {
				throw new Error("Invalid status");
			}
			return input;
		},
	)
	.handler(async ({ data }) => {
		const session = await requireAdmin();

		await db
			.updateTable("report")
			.set({
				status: data.status,
				admin_note: data.adminNote ?? null,
				resolved_by: session.user.id,
				resolved_at: new Date(),
			})
			.where("id", "=", data.reportId)
			.execute();

		return { ok: true };
	});

export const getUnreviewedListings = createServerFn({ method: "GET" })
	.inputValidator((input: { page?: number }) => input)
	.handler(async ({ data }) => {
		await requireAdmin();

		const page = data.page ?? 1;
		const offset = (page - 1) * PAGE_SIZE;

		const [rows, countResult] = await Promise.all([
			db
				.selectFrom("listing")
				.innerJoin("user", "user.id", "listing.owner_id")
				.leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
				.leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
				.select([
					"listing.id",
					"listing.short_id",
					"listing.title",
					"listing.status",
					"listing.city",
					"listing.created_at",
					"user.name as ownerName",
					"motorcycle_make.slug as makeSlug",
					"motorcycle_model.name as modelName",
				])
				.where("listing.reviewed_at", "is", null)
				.where("listing.status", "!=", "removed")
				.orderBy("listing.created_at", "desc")
				.limit(PAGE_SIZE)
				.offset(offset)
				.execute(),
			db
				.selectFrom("listing")
				.select(sql<number>`count(*)::int`.as("total"))
				.where("reviewed_at", "is", null)
				.where("status", "!=", "removed")
				.executeTakeFirstOrThrow(),
		]);

		return {
			listings: rows,
			total: countResult.total,
			page,
			totalPages: Math.ceil(countResult.total / PAGE_SIZE),
		};
	});

export const reviewListing = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware()])
	.inputValidator((input: { listingId: string; action: "approve" | "remove" }) => {
		if (!["approve", "remove"].includes(input.action)) {
			throw new Error("Invalid action");
		}
		return input;
	})
	.handler(async ({ data }) => {
		await requireAdmin();

		if (data.action === "approve") {
			await db
				.updateTable("listing")
				.set({ reviewed_at: new Date() })
				.where("id", "=", data.listingId)
				.execute();
		} else {
			await db
				.updateTable("listing")
				.set({ status: "removed", reviewed_at: new Date(), updated_at: new Date() })
				.where("id", "=", data.listingId)
				.execute();
		}

		return { ok: true };
	});

export const getModerationCounts = createServerFn({ method: "GET" }).handler(async () => {
	await requireAdmin();

	const [reports, listings] = await Promise.all([
		db
			.selectFrom("report")
			.select(sql<number>`count(*)::int`.as("count"))
			.where("status", "=", "pending")
			.executeTakeFirstOrThrow(),
		db
			.selectFrom("listing")
			.select(sql<number>`count(*)::int`.as("count"))
			.where("reviewed_at", "is", null)
			.where("status", "!=", "removed")
			.executeTakeFirstOrThrow(),
	]);

	return { pendingReports: reports.count, unreviewedListings: listings.count };
});
