import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "kysely";
import { useState } from "react";
import { SITE_NAME } from "~/lib/constants";
import { db } from "~/lib/db/index";
import { useTranslation } from "~/lib/i18n";
import { getSession } from "~/lib/session";

const getMyBookings = createServerFn({ method: "GET" }).handler(async () => {
	const session = await getSession();
	if (!session) {
		throw new Error("Kirjaudu sisään");
	}

	const userId = session.user.id;

	const incoming = await db
		.selectFrom("booking")
		.innerJoin("listing", "listing.id", "booking.listing_id")
		.innerJoin("profile as renter_profile", "renter_profile.user_id", "booking.renter_user_id")
		.select([
			"booking.short_id",
			"booking.status",
			sql<string>`to_char(booking.start_date, 'YYYY-MM-DD')`.as("start_date"),
			sql<string>`to_char(booking.end_date, 'YYYY-MM-DD')`.as("end_date"),
			"booking.created_at",
			"listing.title as listing_title",
			"listing.short_id as listing_short_id",
			"renter_profile.display_name as renter_name",
		])
		.where("listing.owner_id", "=", userId)
		.orderBy("booking.created_at", "desc")
		.execute();

	const outgoing = await db
		.selectFrom("booking")
		.innerJoin("listing", "listing.id", "booking.listing_id")
		.select([
			"booking.short_id",
			"booking.status",
			sql<string>`to_char(booking.start_date, 'YYYY-MM-DD')`.as("start_date"),
			sql<string>`to_char(booking.end_date, 'YYYY-MM-DD')`.as("end_date"),
			"booking.created_at",
			"listing.title as listing_title",
		])
		.where("booking.renter_user_id", "=", userId)
		.orderBy("booking.created_at", "desc")
		.execute();

	return { incoming, outgoing };
});

export const Route = createFileRoute("/omat/varaukset")({
	loader: async () => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/kirjaudu", search: { redirect: undefined } });
		}
		return getMyBookings();
	},
	head: () => ({ meta: [{ title: `Varaukset — ${SITE_NAME}` }] }),
	component: BookingsListPage,
});

function BookingsListPage() {
	const { incoming, outgoing } = Route.useLoaderData();
	const { t } = useTranslation("profile");
	const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
	const rows = tab === "incoming" ? incoming : outgoing;

	return (
		<div className="mx-auto max-w-3xl px-4 py-8">
			<h1 className="text-2xl font-bold">{t("bookings.listTitle")}</h1>
			<div className="mt-4 flex gap-2 border-b border-border">
				{(["incoming", "outgoing"] as const).map((key) => (
					<button
						type="button"
						key={key}
						onClick={() => setTab(key)}
						className={`-mb-px border-b-2 px-3 py-2 text-sm ${
							tab === key
								? "border-accent text-accent"
								: "border-transparent text-muted hover:text-foreground"
						}`}
						data-testid={`bookings-tab-${key}`}
					>
						{t(`bookings.tabs.${key}`)}
					</button>
				))}
			</div>

			{rows.length === 0 ? (
				<p className="mt-8 text-muted">
					{t(tab === "incoming" ? "bookings.emptyIncoming" : "bookings.emptyOutgoing")}
				</p>
			) : (
				<ul className="mt-4 space-y-2">
					{rows.map((b) => (
						<li key={b.short_id}>
							<Link
								to="/omat/varaukset/$bookingId"
								params={{ bookingId: b.short_id }}
								className="block rounded-l border border-border bg-card p-4 hover:border-accent"
								data-testid="booking-row"
							>
								<div className="flex items-center justify-between gap-3">
									<div>
										<div className="font-medium">{b.listing_title}</div>
										<div className="mt-0.5 text-xs text-muted">
											{b.start_date} – {b.end_date}
											{"renter_name" in b ? ` · ${b.renter_name}` : null}
										</div>
									</div>
									<span className="rounded-full bg-muted-light px-2 py-0.5 text-xs">
										{t(`bookings.status.${b.status}`)}
									</span>
								</div>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
