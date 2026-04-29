import { createFileRoute, getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { CheckCircle, ExternalLink, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { getReports, getUnreviewedListings, resolveReport, reviewListing } from "~/lib/reports";

import { computeListingSlug } from "~/lib/slug";

type Tab = "listings" | "reports";
type ReportStatus = "pending" | "resolved" | "dismissed" | "all";

export const Route = createFileRoute("/admin/moderation")({
	validateSearch: (search: Record<string, unknown>) => ({
		tab: (search.tab as Tab) || "listings",
		page: Number(search.page) || 1,
		reportStatus: (search.reportStatus as ReportStatus) || "pending",
	}),
	loaderDeps: ({ search }) => search,
	loader: async ({ deps }) => {
		if (deps.tab === "reports") {
			const reports = await getReports({
				data: { status: deps.reportStatus, page: deps.page },
			});
			return { listings: null, reports };
		}
		const listings = await getUnreviewedListings({ data: { page: deps.page } });
		return { listings, reports: null };
	},
	component: ModerationPage,
});

const adminRoute = getRouteApi("/admin");

function ModerationPage() {
	const { listings, reports } = Route.useLoaderData();
	const counts = adminRoute.useLoaderData();
	const { tab, page, reportStatus } = Route.useSearch();
	const navigate = useNavigate({ from: "/admin/moderation" });

	function setTab(t: Tab) {
		navigate({ search: { tab: t, page: 1, reportStatus } });
	}

	return (
		<div>
			<h1 className="mb-6 text-xl font-bold text-foreground">Moderation</h1>

			{/* Tab switcher */}
			<div className="mb-6 flex gap-1 border-b border-border">
				<button
					type="button"
					onClick={() => setTab("listings")}
					className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
						tab === "listings"
							? "border-accent text-accent"
							: "border-transparent text-muted hover:text-foreground"
					}`}
				>
					New Listings
					{counts.unreviewedListings > 0 && (
						<span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
							{counts.unreviewedListings}
						</span>
					)}
				</button>
				<button
					type="button"
					onClick={() => setTab("reports")}
					className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
						tab === "reports"
							? "border-accent text-accent"
							: "border-transparent text-muted hover:text-foreground"
					}`}
				>
					Reports
					{counts.pendingReports > 0 && (
						<span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
							{counts.pendingReports}
						</span>
					)}
				</button>
			</div>

			{tab === "listings" && listings ? (
				<NewListingsTab
					data={listings}
					page={page}
					onPageChange={(p) => navigate({ search: (prev) => ({ ...prev, page: p }) })}
				/>
			) : reports ? (
				<ReportsTab
					data={reports}
					page={page}
					reportStatus={reportStatus}
					onPageChange={(p) => navigate({ search: (prev) => ({ ...prev, page: p }) })}
					onStatusChange={(s) =>
						navigate({ search: (prev) => ({ ...prev, reportStatus: s, page: 1 }) })
					}
				/>
			) : null}
		</div>
	);
}

function NewListingsTab({
	data,
	page,
	onPageChange,
}: {
	data: Awaited<ReturnType<typeof getUnreviewedListings>>;
	page: number;
	onPageChange: (p: number) => void;
}) {
	const router = useRouter();

	async function handleReview(listingId: string, action: "approve" | "remove") {
		if (action === "remove" && !window.confirm("Remove this listing?")) {
			return;
		}
		await reviewListing({ data: { listingId, action } });
		router.invalidate();
	}

	return (
		<>
			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-left text-sm">
					<thead className="border-b border-border bg-muted-light/30">
						<tr>
							<th className="px-4 py-3">Title</th>
							<th className="px-4 py-3">Owner</th>
							<th className="px-4 py-3">City</th>
							<th className="px-4 py-3">Created</th>
							<th className="px-4 py-3">Actions</th>
						</tr>
					</thead>
					<tbody>
						{data.listings.map((listing) => (
							<tr key={listing.id} className="border-b border-border last:border-0">
								<td className="px-4 py-3">
									<a
										href={`/ilmoitukset/${listing.short_id}/${computeListingSlug(listing.makeSlug ?? null, listing.modelName ?? null, listing.city)}`}
										target="_blank"
										rel="noreferrer"
										className="font-medium text-accent hover:underline"
									>
										{listing.title}
										<ExternalLink size={12} className="ml-1 inline" />
									</a>
								</td>
								<td className="px-4 py-3 text-muted">{listing.ownerName}</td>
								<td className="px-4 py-3 text-muted">{listing.city}</td>
								<td className="px-4 py-3 text-muted">
									{new Date(listing.created_at).toLocaleDateString("fi")}
								</td>
								<td className="px-4 py-3">
									<div className="flex gap-2">
										<button
											type="button"
											onClick={() => handleReview(listing.id, "approve")}
											className="flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
										>
											<CheckCircle size={12} /> Approve
										</button>
										<button
											type="button"
											onClick={() => handleReview(listing.id, "remove")}
											className="flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
										>
											<Trash2 size={12} /> Remove
										</button>
									</div>
								</td>
							</tr>
						))}
						{data.listings.length === 0 && (
							<tr>
								<td colSpan={5} className="px-4 py-8 text-center text-muted">
									No unreviewed listings.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
			<Pagination
				page={page}
				totalPages={data.totalPages}
				total={data.total}
				onChange={onPageChange}
			/>
		</>
	);
}

function ReportsTab({
	data,
	page,
	reportStatus,
	onPageChange,
	onStatusChange,
}: {
	data: Awaited<ReturnType<typeof getReports>>;
	page: number;
	reportStatus: ReportStatus;
	onPageChange: (p: number) => void;
	onStatusChange: (s: ReportStatus) => void;
}) {
	const router = useRouter();
	const [resolvingId, setResolvingId] = useState<string | null>(null);
	const [adminNote, setAdminNote] = useState("");

	async function handleResolve(reportId: string, status: "resolved" | "dismissed") {
		await resolveReport({ data: { reportId, status, adminNote: adminNote || undefined } });
		setResolvingId(null);
		setAdminNote("");
		router.invalidate();
	}

	return (
		<>
			<div className="mb-4">
				<select
					value={reportStatus}
					onChange={(e) => onStatusChange(e.target.value as ReportStatus)}
					className="rounded-md border border-border bg-white px-3 py-2 text-sm"
					aria-label="Filter by status"
				>
					<option value="pending">Pending</option>
					<option value="resolved">Resolved</option>
					<option value="dismissed">Dismissed</option>
					<option value="all">All</option>
				</select>
			</div>

			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-left text-sm">
					<thead className="border-b border-border bg-muted-light/30">
						<tr>
							<th className="px-4 py-3">Type</th>
							<th className="px-4 py-3">Target</th>
							<th className="px-4 py-3">Reason</th>
							<th className="px-4 py-3">Reporter</th>
							<th className="px-4 py-3">Date</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3">Actions</th>
						</tr>
					</thead>
					<tbody>
						{data.reports.map((report) => (
							<tr key={report.id} className="border-b border-border last:border-0">
								<td className="px-4 py-3">
									<span
										className={`rounded-full px-2 py-0.5 text-xs font-medium ${
											report.target_type === "listing"
												? "bg-blue-100 text-blue-800"
												: "bg-purple-100 text-purple-800"
										}`}
									>
										{report.target_type}
									</span>
								</td>
								<td className="px-4 py-3">
									<a
										href={
											report.target_type === "listing" && report.listingShortId
												? `/ilmoitukset/${report.listingShortId}/${computeListingSlug(report.listingMakeSlug ?? null, report.listingModelName ?? null, report.listingCity ?? "")}`
												: `/profiili/${report.target_id}`
										}
										target="_blank"
										rel="noreferrer"
										className="text-accent hover:underline"
									>
										{report.targetName ?? report.target_id.slice(0, 8)}
										<ExternalLink size={12} className="ml-1 inline" />
									</a>
								</td>
								<td className="max-w-xs truncate px-4 py-3 text-muted" title={report.reason}>
									{report.reason}
								</td>
								<td className="px-4 py-3 text-muted">{report.reporterName}</td>
								<td className="px-4 py-3 text-muted">
									{new Date(report.created_at).toLocaleDateString("fi")}
								</td>
								<td className="px-4 py-3">
									<ReportStatusBadge status={report.status} />
								</td>
								<td className="px-4 py-3">
									{report.status === "pending" ? (
										resolvingId === report.id ? (
											<div className="flex flex-col gap-2">
												<input
													type="text"
													value={adminNote}
													onChange={(e) => setAdminNote(e.target.value)}
													placeholder="Admin note (optional)"
													className="rounded border border-border px-2 py-1 text-xs"
												/>
												<div className="flex gap-1">
													<button
														type="button"
														onClick={() => handleResolve(report.id, "resolved")}
														className="flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
													>
														<CheckCircle size={12} /> Resolve
													</button>
													<button
														type="button"
														onClick={() => handleResolve(report.id, "dismissed")}
														className="flex items-center gap-1 rounded bg-gray-600 px-2 py-1 text-xs text-white hover:bg-gray-700"
													>
														<XCircle size={12} /> Dismiss
													</button>
													<button
														type="button"
														onClick={() => {
															setResolvingId(null);
															setAdminNote("");
														}}
														className="rounded border border-border px-2 py-1 text-xs hover:bg-muted-light"
													>
														Cancel
													</button>
												</div>
											</div>
										) : (
											<button
												type="button"
												onClick={() => setResolvingId(report.id)}
												className="rounded border border-border px-2 py-1 text-xs hover:bg-muted-light"
											>
												Review
											</button>
										)
									) : (
										<span className="text-xs text-muted">{report.admin_note ?? "—"}</span>
									)}
								</td>
							</tr>
						))}
						{data.reports.length === 0 && (
							<tr>
								<td colSpan={7} className="px-4 py-8 text-center text-muted">
									No reports found.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
			<Pagination
				page={page}
				totalPages={data.totalPages}
				total={data.total}
				onChange={onPageChange}
			/>
		</>
	);
}

function ReportStatusBadge({ status }: { status: string }) {
	const colors: Record<string, string> = {
		pending: "bg-yellow-100 text-yellow-800",
		resolved: "bg-green-100 text-green-800",
		dismissed: "bg-gray-100 text-gray-800",
	};
	return (
		<span
			className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-800"}`}
		>
			{status}
		</span>
	);
}

function Pagination({
	page,
	totalPages,
	total,
	onChange,
}: {
	page: number;
	totalPages: number;
	total: number;
	onChange: (p: number) => void;
}) {
	if (totalPages <= 1) {
		return null;
	}
	return (
		<div className="mt-4 flex items-center justify-between text-sm">
			<span className="text-muted">
				Page {page} of {totalPages} ({total} total)
			</span>
			<div className="flex gap-2">
				<button
					type="button"
					disabled={page <= 1}
					onClick={() => onChange(page - 1)}
					className="rounded border border-border px-3 py-1 disabled:opacity-50"
				>
					Previous
				</button>
				<button
					type="button"
					disabled={page >= totalPages}
					onClick={() => onChange(page + 1)}
					className="rounded border border-border px-3 py-1 disabled:opacity-50"
				>
					Next
				</button>
			</div>
		</div>
	);
}
