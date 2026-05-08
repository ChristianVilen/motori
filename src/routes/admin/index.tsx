import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "kysely";

const PERIODS = {
	"24h": { label: "24 hours", ms: 24 * 60 * 60 * 1000 },
	"7d": { label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
	"30d": { label: "30 days", ms: 30 * 24 * 60 * 60 * 1000 },
} as const;

type Period = keyof typeof PERIODS;

const getStats = createServerFn({ method: "GET" })
	.inputValidator((input: { period?: Period }) => input)
	.handler(async ({ data }) => {
		const period = data.period ?? "7d";
		const since = new Date(Date.now() - PERIODS[period].ms);

		const { db } = await import("~/lib/db/index");
		const [users, listings, signups, byStatus] = await Promise.all([
			db
				.selectFrom("user")
				.select(sql<number>`count(*)::int`.as("count"))
				.executeTakeFirstOrThrow(),
			db
				.selectFrom("listing")
				.select(sql<number>`count(*)::int`.as("count"))
				.executeTakeFirstOrThrow(),
			db
				.selectFrom("user")
				.select(sql<number>`count(*)::int`.as("count"))
				.where("createdAt", ">=", since)
				.executeTakeFirstOrThrow(),
			db
				.selectFrom("listing")
				.select(["status", sql<number>`count(*)::int`.as("count")])
				.groupBy("status")
				.execute(),
		]);

		return {
			totalUsers: users.count,
			totalListings: listings.count,
			signups: signups.count,
			period,
			listingsByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.count])) as Record<
				string,
				number
			>,
		};
	});

export const Route = createFileRoute("/admin/")({
	validateSearch: (search: Record<string, unknown>) => ({
		period: (search.period as Period) || undefined,
	}),
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => getStats({ data: deps }),
	component: StatsPage,
});

function StatCard({ label, value }: { label: string; value: number | string }) {
	return (
		<div className="rounded-lg border border-border bg-white p-6">
			<p className="text-sm text-muted">{label}</p>
			<p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
		</div>
	);
}

function StatsPage() {
	const stats = Route.useLoaderData();
	const { period } = Route.useSearch();
	const navigate = useNavigate({ from: "/admin/" });

	return (
		<div>
			<h1 className="mb-6 text-xl font-bold text-foreground">Overview</h1>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard label="Total users" value={stats.totalUsers} />
				<StatCard label="Total listings" value={stats.totalListings} />
				<div className="rounded-lg border border-border bg-white p-6">
					<div className="flex items-center justify-between">
						<p className="text-sm text-muted">New signups</p>
						<select
							value={period ?? "7d"}
							onChange={(e) => navigate({ search: { period: e.target.value as Period } })}
							className="rounded border border-border bg-white px-1.5 py-0.5 text-xs text-muted"
							aria-label="Signups time period"
						>
							{Object.entries(PERIODS).map(([key, { label }]) => (
								<option key={key} value={key}>
									{label}
								</option>
							))}
						</select>
					</div>
					<p className="mt-1 text-3xl font-bold text-foreground">{stats.signups}</p>
				</div>
				<StatCard label="Active listings" value={stats.listingsByStatus.active ?? 0} />
			</div>
			<h2 className="mt-8 mb-4 text-lg font-semibold text-foreground">Listings by status</h2>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{["active", "paused", "rented", "removed"].map((status) => (
					<StatCard
						key={status}
						label={status.charAt(0).toUpperCase() + status.slice(1)}
						value={stats.listingsByStatus[status] ?? 0}
					/>
				))}
			</div>
		</div>
	);
}
