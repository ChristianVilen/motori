import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { ShieldBan, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { requireAdmin } from "~/lib/admin";
import { auth } from "~/lib/auth";
import { csrfOnly } from "~/lib/middleware";

const PAGE_SIZE = 25;

const getAdminUsers = createServerFn({ method: "GET" })
	.inputValidator((input: { search?: string; page?: number }) => input)
	.handler(async ({ data }) => {
		const request = getRequest();
		await requireAdmin();

		const page = data.page ?? 1;
		const offset = (page - 1) * PAGE_SIZE;

		const result = await auth.api.listUsers({
			query: {
				limit: PAGE_SIZE,
				offset,
				...(data.search
					? {
							searchValue: data.search,
							searchField: "email" as const,
							searchOperator: "contains" as const,
						}
					: {}),
				sortBy: "createdAt",
				sortDirection: "desc",
			},
			headers: request.headers,
		});

		return {
			users: result.users,
			total: result.total,
			page,
			totalPages: Math.ceil(result.total / PAGE_SIZE),
		};
	});

const banUser = createServerFn({ method: "POST" })
	.middleware(csrfOnly())
	.inputValidator((input: { userId: string; reason?: string }) => input)
	.handler(async ({ data }) => {
		const request = getRequest();
		await requireAdmin();
		await auth.api.banUser({
			body: { userId: data.userId, banReason: data.reason },
			headers: request.headers,
		});
	});

const unbanUser = createServerFn({ method: "POST" })
	.middleware(csrfOnly())
	.inputValidator((input: { userId: string }) => input)
	.handler(async ({ data }) => {
		const request = getRequest();
		await requireAdmin();
		await auth.api.unbanUser({
			body: { userId: data.userId },
			headers: request.headers,
		});
	});

export const Route = createFileRoute("/admin/users")({
	validateSearch: (search: Record<string, unknown>) => ({
		search: (search.search as string) || undefined,
		page: Number(search.page) || 1,
	}),
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => getAdminUsers({ data: deps }),
	component: UsersPage,
});

function UsersPage() {
	const data = Route.useLoaderData();
	const { search, page } = Route.useSearch();
	const navigate = useNavigate({ from: "/admin/users" });
	const [searchInput, setSearchInput] = useState(search ?? "");

	function updateSearch(params: Record<string, unknown>) {
		navigate({ search: (prev) => ({ ...prev, ...params, page: 1 }) });
	}

	async function handleBan(userId: string) {
		if (
			!window.confirm("Are you sure you want to ban this user? All their sessions will be revoked.")
		) {
			return;
		}
		await banUser({ data: { userId } });
		navigate({ search: (prev) => ({ ...prev }) });
	}

	async function handleUnban(userId: string) {
		if (!window.confirm("Are you sure you want to unban this user?")) {
			return;
		}
		await unbanUser({ data: { userId } });
		navigate({ search: (prev) => ({ ...prev }) });
	}

	return (
		<div>
			<h1 className="mb-6 text-xl font-bold text-foreground">Users</h1>

			{/* Search */}
			<form
				onSubmit={(e) => {
					e.preventDefault();
					updateSearch({ search: searchInput || undefined });
				}}
				className="mb-4 flex gap-2"
			>
				<input
					type="text"
					value={searchInput}
					onChange={(e) => setSearchInput(e.target.value)}
					placeholder="Search by email…"
					className="rounded-md border border-border bg-white px-3 py-2 text-sm"
				/>
				<button
					type="submit"
					className="rounded-md bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90"
				>
					Search
				</button>
			</form>

			{/* Table */}
			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-left text-sm">
					<thead className="border-b border-border bg-muted-light/30">
						<tr>
							<th className="px-4 py-3">Name</th>
							<th className="px-4 py-3">Email</th>
							<th className="px-4 py-3">Role</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3">Created</th>
							<th className="px-4 py-3">Actions</th>
						</tr>
					</thead>
					<tbody>
						{data.users.map((user) => (
							<tr key={user.id} className="border-b border-border last:border-0">
								<td className="px-4 py-3 font-medium">{user.name}</td>
								<td className="px-4 py-3 text-muted">{user.email}</td>
								<td className="px-4 py-3">
									<span
										className={`rounded-full px-2 py-0.5 text-xs font-medium ${
											user.role === "admin"
												? "bg-purple-100 text-purple-800"
												: "bg-gray-100 text-gray-800"
										}`}
									>
										{user.role}
									</span>
								</td>
								<td className="px-4 py-3">
									{user.banned ? (
										<span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
											Banned
										</span>
									) : (
										<span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
											Active
										</span>
									)}
								</td>
								<td className="px-4 py-3 text-muted">
									{new Date(user.createdAt).toLocaleDateString("fi")}
								</td>
								<td className="px-4 py-3">
									{user.role !== "admin" &&
										(user.banned ? (
											<button
												type="button"
												onClick={() => handleUnban(user.id)}
												className="flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
											>
												<ShieldCheck size={12} /> Unban
											</button>
										) : (
											<button
												type="button"
												onClick={() => handleBan(user.id)}
												className="flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
											>
												<ShieldBan size={12} /> Ban
											</button>
										))}
								</td>
							</tr>
						))}
						{data.users.length === 0 && (
							<tr>
								<td colSpan={6} className="px-4 py-8 text-center text-muted">
									No users found.
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
