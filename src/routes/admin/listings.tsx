import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ExpressionBuilder } from "kysely";
import { sql } from "kysely";
import { Pause, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { requireAdmin } from "~/lib/admin";
import { db } from "~/lib/db/index";
import type { Database } from "~/lib/db/schema";

const PAGE_SIZE = 25;
const MAX_BULK_IDS = 100;

type ListingStatus = "active" | "paused" | "rented" | "removed";

function escapeLike(value: string) {
	return value.replace(/[%_\\]/g, "\\$&");
}

function applyListingFilters(
	eb: ExpressionBuilder<Database, "listing">,
	filters: { status?: ListingStatus; search?: string },
) {
	const conditions = [];
	if (filters.status) {
		conditions.push(eb("status", "=", filters.status));
	}
	if (filters.search) {
		const term = `%${escapeLike(filters.search)}%`;
		conditions.push(
			eb.or([eb("title", "ilike", term), eb("brand", "ilike", term), eb("model", "ilike", term)]),
		);
	}
	return conditions.length > 0 ? eb.and(conditions) : eb.val(true);
}

const getAdminListings = createServerFn({ method: "GET" })
	.inputValidator((input: { status?: ListingStatus; search?: string; page?: number }) => input)
	.handler(async ({ data }) => {
		await requireAdmin();

		const page = data.page ?? 1;
		const offset = (page - 1) * PAGE_SIZE;

		const [rows, countResult] = await Promise.all([
			db
				.selectFrom("listing")
				.innerJoin("user", "user.id", "listing.owner_id")
				.select([
					"listing.id",
					"listing.title",
					"listing.status",
					"listing.city",
					"listing.created_at",
					"user.name as ownerName",
				])
				.where((eb) => applyListingFilters(eb, data))
				.orderBy("listing.created_at", "desc")
				.limit(PAGE_SIZE)
				.offset(offset)
				.execute(),
			db
				.selectFrom("listing")
				.select(sql<number>`count(*)::int`.as("total"))
				.where((eb) => applyListingFilters(eb, data))
				.executeTakeFirstOrThrow(),
		]);

		return {
			listings: rows,
			total: countResult.total,
			page,
			totalPages: Math.ceil(countResult.total / PAGE_SIZE),
		};
	});

const updateListingStatuses = createServerFn({ method: "POST" })
	.inputValidator((input: { ids: string[]; status: ListingStatus }) => {
		if (input.ids.length > MAX_BULK_IDS) {
			throw new Error(`Cannot update more than ${MAX_BULK_IDS} listings at once`);
		}
		return input;
	})
	.handler(async ({ data }) => {
		await requireAdmin();
		if (data.ids.length === 0) {
			return;
		}
		await db
			.updateTable("listing")
			.set({ status: data.status, updated_at: new Date() })
			.where("id", "in", data.ids)
			.execute();
	});

export const Route = createFileRoute("/admin/listings")({
	validateSearch: (search: Record<string, unknown>) => ({
		status: (search.status as ListingStatus) || undefined,
		search: (search.search as string) || undefined,
		page: Number(search.page) || 1,
	}),
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => getAdminListings({ data: deps }),
	component: ListingsPage,
});

function ListingsPage() {
	const data = Route.useLoaderData();
	const { status, search, page } = Route.useSearch();
	const navigate = useNavigate({ from: "/admin/listings" });
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [searchInput, setSearchInput] = useState(search ?? "");

	function updateSearch(params: Record<string, unknown>) {
		setSelected(new Set());
		navigate({ search: (prev) => ({ ...prev, ...params, page: 1 }) });
	}

	function toggleSelect(id: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}

	function toggleAll() {
		if (selected.size === data.listings.length) {
			setSelected(new Set());
		} else {
			setSelected(new Set(data.listings.map((l) => l.id)));
		}
	}

	async function bulkAction(newStatus: ListingStatus) {
		if (selected.size === 0) {
			return;
		}
		await updateListingStatuses({ data: { ids: [...selected], status: newStatus } });
		setSelected(new Set());
		navigate({ search: (prev) => ({ ...prev }) });
	}

	return (
		<div>
			<h1 className="mb-6 text-xl font-bold text-foreground">Listings</h1>

			{/* Filters */}
			<div className="mb-4 flex flex-wrap items-center gap-3">
				<select
					value={status ?? ""}
					onChange={(e) => updateSearch({ status: e.target.value || undefined })}
					className="rounded-md border border-border bg-white px-3 py-2 text-sm"
					aria-label="Filter by status"
				>
					<option value="">All statuses</option>
					<option value="active">Active</option>
					<option value="paused">Paused</option>
					<option value="rented">Rented</option>
					<option value="removed">Removed</option>
				</select>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						updateSearch({ search: searchInput || undefined });
					}}
					className="flex gap-2"
				>
					<input
						type="text"
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						placeholder="Search title, brand, model…"
						className="rounded-md border border-border bg-white px-3 py-2 text-sm"
					/>
					<button
						type="submit"
						className="rounded-md bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90"
					>
						Search
					</button>
				</form>
			</div>

			{/* Bulk actions */}
			{selected.size > 0 && (
				<div className="mb-4 flex items-center gap-3 rounded-md bg-muted-light/50 px-4 py-2 text-sm">
					<span className="font-medium">{selected.size} selected</span>
					<button
						type="button"
						onClick={() => bulkAction("removed")}
						className="flex items-center gap-1 rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700"
					>
						<Trash2 size={14} /> Remove
					</button>
					<button
						type="button"
						onClick={() => bulkAction("paused")}
						className="flex items-center gap-1 rounded bg-yellow-600 px-3 py-1 text-white hover:bg-yellow-700"
					>
						<Pause size={14} /> Pause
					</button>
					<button
						type="button"
						onClick={() => bulkAction("active")}
						className="flex items-center gap-1 rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700"
					>
						<Play size={14} /> Activate
					</button>
				</div>
			)}

			{/* Table */}
			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-left text-sm">
					<thead className="border-b border-border bg-muted-light/30">
						<tr>
							<th className="px-4 py-3">
								<input
									type="checkbox"
									checked={data.listings.length > 0 && selected.size === data.listings.length}
									onChange={toggleAll}
									aria-label="Select all"
								/>
							</th>
							<th className="px-4 py-3">Title</th>
							<th className="px-4 py-3">Owner</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3">City</th>
							<th className="px-4 py-3">Created</th>
						</tr>
					</thead>
					<tbody>
						{data.listings.map((listing) => (
							<tr key={listing.id} className="border-b border-border last:border-0">
								<td className="px-4 py-3">
									<input
										type="checkbox"
										checked={selected.has(listing.id)}
										onChange={() => toggleSelect(listing.id)}
										aria-label={`Select ${listing.title}`}
									/>
								</td>
								<td className="px-4 py-3 font-medium">{listing.title}</td>
								<td className="px-4 py-3 text-muted">{listing.ownerName}</td>
								<td className="px-4 py-3">
									<StatusBadge status={listing.status} />
								</td>
								<td className="px-4 py-3 text-muted">{listing.city}</td>
								<td className="px-4 py-3 text-muted">
									{new Date(listing.created_at).toLocaleDateString("fi")}
								</td>
							</tr>
						))}
						{data.listings.length === 0 && (
							<tr>
								<td colSpan={6} className="px-4 py-8 text-center text-muted">
									No listings found.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{/* Pagination */}
			{data.totalPages > 1 && (
				<div className="mt-4 flex items-center justify-between text-sm">
					<span className="text-muted">
						Page {data.page} of {data.totalPages} ({data.total} total)
					</span>
					<div className="flex gap-2">
						<button
							type="button"
							disabled={page <= 1}
							onClick={() => navigate({ search: (prev) => ({ ...prev, page: page - 1 }) })}
							className="rounded border border-border px-3 py-1 disabled:opacity-50"
						>
							Previous
						</button>
						<button
							type="button"
							disabled={page >= data.totalPages}
							onClick={() => navigate({ search: (prev) => ({ ...prev, page: page + 1 }) })}
							className="rounded border border-border px-3 py-1 disabled:opacity-50"
						>
							Next
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, string> = {
		active: "bg-green-100 text-green-800",
		paused: "bg-yellow-100 text-yellow-800",
		rented: "bg-blue-100 text-blue-800",
		removed: "bg-red-100 text-red-800",
	};
	return (
		<span
			className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-800"}`}
		>
			{status}
		</span>
	);
}
