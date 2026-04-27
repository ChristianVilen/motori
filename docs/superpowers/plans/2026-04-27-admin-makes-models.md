# Admin Makes & Models Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `/admin/makes` page where the admin can rename, delete, and merge motorcycle makes and models to fix typos and duplicates.

**Architecture:** New server functions in `src/lib/admin-makes.ts` provide all data and mutations. A single new route `src/routes/admin/makes.tsx` renders two plain tables (makes + models) with inline rename, merge, and delete. The admin nav in `src/routes/admin/route.tsx` gets a new tab.

**Tech Stack:** TanStack Start (createServerFn), Kysely, React local state for inline editing, lucide-react icons.

---

## File Map

| Action | File |
|---|---|
| Create | `src/lib/admin-makes.ts` |
| Create | `src/routes/admin/makes.tsx` |
| Modify | `src/routes/admin/route.tsx` |

---

### Task 1: Server functions

**Files:**
- Create: `src/lib/admin-makes.ts`

- [ ] Create `src/lib/admin-makes.ts` with the following content:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { sql } from "kysely";
import { requireAdmin } from "~/lib/admin";
import { csrfMiddleware } from "~/lib/csrf";
import { db } from "~/lib/db/index";
import { toSlug } from "~/lib/makes";

export interface AdminMake {
	id: string;
	name: string;
	slug: string;
	listingCount: number;
	modelCount: number;
}

export interface AdminModel {
	id: string;
	name: string;
	makeId: string;
	makeName: string;
	listingCount: number;
}

export const getAdminMakes = createServerFn({ method: "GET" }).handler(async () => {
	await requireAdmin();
	const rows = await db
		.selectFrom("motorcycle_make as mk")
		.leftJoin("motorcycle_model as mo", "mo.make_id", "mk.id")
		.leftJoin("listing as l", "l.make_id", "mk.id")
		.select([
			"mk.id",
			"mk.name",
			"mk.slug",
			sql<number>`count(distinct mo.id)::int`.as("modelCount"),
			sql<number>`count(distinct l.id)::int`.as("listingCount"),
		])
		.groupBy(["mk.id", "mk.name", "mk.slug"])
		.orderBy("mk.name", "asc")
		.execute();
	return rows as AdminMake[];
});

export const getAdminModels = createServerFn({ method: "GET" })
	.inputValidator((makeId: string | null) => makeId)
	.handler(async ({ data: makeId }) => {
		await requireAdmin();
		let query = db
			.selectFrom("motorcycle_model as mo")
			.innerJoin("motorcycle_make as mk", "mk.id", "mo.make_id")
			.leftJoin("listing as l", "l.model_id", "mo.id")
			.select([
				"mo.id",
				"mo.name",
				"mo.make_id as makeId",
				"mk.name as makeName",
				sql<number>`count(distinct l.id)::int`.as("listingCount"),
			])
			.groupBy(["mo.id", "mo.name", "mo.make_id", "mk.name"])
			.orderBy("mk.name", "asc")
			.orderBy("mo.name", "asc");
		if (makeId) {
			query = query.where("mo.make_id", "=", makeId);
		}
		const rows = await query.execute();
		return rows as AdminModel[];
	});

export const renameMake = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware()])
	.inputValidator((data: { id: string; name: string }) => data)
	.handler(async ({ data }) => {
		await requireAdmin();
		const name = data.name.trim();
		if (!name) throw new Error("Name cannot be empty");
		await db
			.updateTable("motorcycle_make")
			.set({ name, slug: toSlug(name) })
			.where("id", "=", data.id)
			.execute();
	});

export const renameModel = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware()])
	.inputValidator((data: { id: string; name: string }) => data)
	.handler(async ({ data }) => {
		await requireAdmin();
		const name = data.name.trim();
		if (!name) throw new Error("Name cannot be empty");
		await db
			.updateTable("motorcycle_model")
			.set({ name })
			.where("id", "=", data.id)
			.execute();
	});

export const deleteMake = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware()])
	.inputValidator((id: string) => id)
	.handler(async ({ data: id }) => {
		await requireAdmin();
		const row = await db
			.selectFrom("motorcycle_make as mk")
			.leftJoin("motorcycle_model as mo", "mo.make_id", "mk.id")
			.leftJoin("listing as l", "l.make_id", "mk.id")
			.select([
				sql<number>`count(distinct mo.id)::int`.as("modelCount"),
				sql<number>`count(distinct l.id)::int`.as("listingCount"),
			])
			.where("mk.id", "=", id)
			.groupBy("mk.id")
			.executeTakeFirst();
		if (row && (row.modelCount > 0 || row.listingCount > 0)) {
			throw new Error("Cannot delete a make that has models or listings");
		}
		await db.deleteFrom("motorcycle_make").where("id", "=", id).execute();
	});

export const deleteModel = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware()])
	.inputValidator((id: string) => id)
	.handler(async ({ data: id }) => {
		await requireAdmin();
		const row = await db
			.selectFrom("motorcycle_model as mo")
			.leftJoin("listing as l", "l.model_id", "mo.id")
			.select(sql<number>`count(distinct l.id)::int`.as("listingCount"))
			.where("mo.id", "=", id)
			.groupBy("mo.id")
			.executeTakeFirst();
		if (row && row.listingCount > 0) {
			throw new Error("Cannot delete a model that has listings");
		}
		await db.deleteFrom("motorcycle_model").where("id", "=", id).execute();
	});

export const mergeMakes = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware()])
	.inputValidator((data: { sourceId: string; targetId: string }) => data)
	.handler(async ({ data }) => {
		await requireAdmin();
		if (data.sourceId === data.targetId) throw new Error("Cannot merge a make into itself");
		await db.transaction().execute(async (trx) => {
			await trx
				.updateTable("listing")
				.set({ make_id: data.targetId, updated_at: new Date() })
				.where("make_id", "=", data.sourceId)
				.execute();
			await trx
				.updateTable("motorcycle_model")
				.set({ make_id: data.targetId })
				.where("make_id", "=", data.sourceId)
				.execute();
			await trx.deleteFrom("motorcycle_make").where("id", "=", data.sourceId).execute();
		});
	});

export const mergeModels = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware()])
	.inputValidator((data: { sourceId: string; targetId: string }) => data)
	.handler(async ({ data }) => {
		await requireAdmin();
		if (data.sourceId === data.targetId) throw new Error("Cannot merge a model into itself");
		await db.transaction().execute(async (trx) => {
			await trx
				.updateTable("listing")
				.set({ model_id: data.targetId, updated_at: new Date() })
				.where("model_id", "=", data.sourceId)
				.execute();
			await trx.deleteFrom("motorcycle_model").where("id", "=", data.sourceId).execute();
		});
	});
```

- [ ] Run `pnpm typecheck` — expect no errors.

- [ ] Commit:
```bash
git add src/lib/admin-makes.ts
git commit -m "feat: admin makes/models server functions"
```

---

### Task 2: Admin makes/models page

**Files:**
- Create: `src/routes/admin/makes.tsx`

- [ ] Create `src/routes/admin/makes.tsx`:

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Pencil, Trash2, GitMerge } from "lucide-react";
import { useState } from "react";
import {
	type AdminMake,
	type AdminModel,
	deleteMake,
	deleteModel,
	getAdminMakes,
	getAdminModels,
	mergeMakes,
	mergeModels,
	renameMake,
	renameModel,
} from "~/lib/admin-makes";

export const Route = createFileRoute("/admin/makes")({
	loader: async () => {
		const [makes, models] = await Promise.all([
			getAdminMakes(),
			getAdminModels({ data: null }),
		]);
		return { makes, models };
	},
	component: MakesPage,
});

function useReload() {
	const navigate = useNavigate({ from: "/admin/makes" });
	return () => navigate({ search: (prev) => ({ ...prev }) });
}

// ── Inline rename cell ──────────────────────────────────────────────────────

function RenameCell({
	id,
	name,
	onSave,
}: {
	id: string;
	name: string;
	onSave: (id: string, name: string) => Promise<void>;
}) {
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState(name);
	const [error, setError] = useState<string | null>(null);

	async function save() {
		if (value.trim() === name) { setEditing(false); return; }
		try {
			await onSave(id, value.trim());
			setEditing(false);
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Error");
		}
	}

	if (!editing) {
		return (
			<button
				type="button"
				onClick={() => { setValue(name); setEditing(true); }}
				className="flex items-center gap-1.5 text-left hover:text-accent"
				title="Click to rename"
			>
				{name}
				<Pencil size={12} className="shrink-0 text-muted opacity-0 group-hover:opacity-100" />
			</button>
		);
	}

	return (
		<span className="flex flex-col gap-1">
			<input
				// biome-ignore lint/a11y/noAutofocus: intentional inline edit
				autoFocus
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") save();
					if (e.key === "Escape") setEditing(false);
				}}
				onBlur={save}
				className="rounded border border-input bg-background px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
			/>
			{error && <span className="text-xs text-destructive">{error}</span>}
		</span>
	);
}

// ── Inline merge cell ───────────────────────────────────────────────────────

function MergeCell({
	id,
	options,
	onMerge,
}: {
	id: string;
	options: { id: string; label: string }[];
	onMerge: (sourceId: string, targetId: string) => Promise<void>;
}) {
	const [open, setOpen] = useState(false);
	const [targetId, setTargetId] = useState("");
	const [error, setError] = useState<string | null>(null);

	const others = options.filter((o) => o.id !== id);

	async function confirm() {
		if (!targetId) return;
		try {
			await onMerge(id, targetId);
			setOpen(false);
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Error");
		}
	}

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => { setTargetId(others[0]?.id ?? ""); setOpen(true); }}
				className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
				title="Merge into another"
			>
				<GitMerge size={13} /> Merge
			</button>
		);
	}

	return (
		<span className="flex flex-col gap-1">
			<span className="flex items-center gap-1.5">
				<select
					value={targetId}
					onChange={(e) => setTargetId(e.target.value)}
					className="rounded border border-input bg-background px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
				>
					{others.map((o) => (
						<option key={o.id} value={o.id}>{o.label}</option>
					))}
				</select>
				<button
					type="button"
					onClick={confirm}
					className="rounded bg-accent px-2 py-0.5 text-xs text-white hover:bg-accent/90"
				>
					Confirm
				</button>
				<button
					type="button"
					onClick={() => setOpen(false)}
					className="text-xs text-muted hover:text-foreground"
				>
					Cancel
				</button>
			</span>
			{error && <span className="text-xs text-destructive">{error}</span>}
		</span>
	);
}

// ── Delete button ───────────────────────────────────────────────────────────

function DeleteButton({
	id,
	disabled,
	disabledReason,
	onDelete,
}: {
	id: string;
	disabled: boolean;
	disabledReason: string;
	onDelete: (id: string) => Promise<void>;
}) {
	const [error, setError] = useState<string | null>(null);

	async function handle() {
		try {
			await onDelete(id);
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Error");
		}
	}

	return (
		<span className="flex flex-col gap-0.5">
			<button
				type="button"
				onClick={handle}
				disabled={disabled}
				title={disabled ? disabledReason : "Delete"}
				className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-30"
			>
				<Trash2 size={13} /> Delete
			</button>
			{error && <span className="text-xs text-destructive">{error}</span>}
		</span>
	);
}

// ── Makes table ─────────────────────────────────────────────────────────────

function MakesTable({ makes }: { makes: AdminMake[] }) {
	const reload = useReload();

	const makeOptions = makes.map((m) => ({ id: m.id, label: m.name }));

	async function handleRename(id: string, name: string) {
		await renameMake({ data: { id, name } });
		reload();
	}

	async function handleMerge(sourceId: string, targetId: string) {
		await mergeMakes({ data: { sourceId, targetId } });
		reload();
	}

	async function handleDelete(id: string) {
		await deleteMake({ data: id });
		reload();
	}

	return (
		<div>
			<h2 className="mb-3 text-base font-semibold text-foreground">Makes ({makes.length})</h2>
			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-left text-sm">
					<thead className="border-b border-border bg-muted-light/30">
						<tr>
							<th className="px-4 py-3 font-medium">Name</th>
							<th className="px-4 py-3 font-medium">Models</th>
							<th className="px-4 py-3 font-medium">Listings</th>
							<th className="px-4 py-3 font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{makes.map((make) => (
							<tr key={make.id} className="group border-b border-border last:border-0 hover:bg-muted-light/20">
								<td className="px-4 py-3">
									<RenameCell id={make.id} name={make.name} onSave={handleRename} />
								</td>
								<td className="px-4 py-3 text-muted">{make.modelCount}</td>
								<td className="px-4 py-3 text-muted">{make.listingCount}</td>
								<td className="px-4 py-3">
									<div className="flex items-center gap-3">
										<MergeCell
											id={make.id}
											options={makeOptions}
											onMerge={handleMerge}
										/>
										<DeleteButton
											id={make.id}
											disabled={make.listingCount > 0 || make.modelCount > 0}
											disabledReason="Has listings or models"
											onDelete={handleDelete}
										/>
									</div>
								</td>
							</tr>
						))}
						{makes.length === 0 && (
							<tr>
								<td colSpan={4} className="px-4 py-8 text-center text-muted">No makes.</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}

// ── Models table ────────────────────────────────────────────────────────────

function ModelsTable({ models, makes }: { models: AdminModel[]; makes: AdminMake[] }) {
	const reload = useReload();
	const [makeFilter, setMakeFilter] = useState("");

	const filtered = makeFilter ? models.filter((m) => m.makeId === makeFilter) : models;
	const modelOptions = models.map((m) => ({ id: m.id, label: `${m.makeName} — ${m.name}` }));

	async function handleRename(id: string, name: string) {
		await renameModel({ data: { id, name } });
		reload();
	}

	async function handleMerge(sourceId: string, targetId: string) {
		await mergeModels({ data: { sourceId, targetId } });
		reload();
	}

	async function handleDelete(id: string) {
		await deleteModel({ data: id });
		reload();
	}

	return (
		<div>
			<div className="mb-3 flex items-center gap-4">
				<h2 className="text-base font-semibold text-foreground">Models ({filtered.length}{makeFilter ? ` of ${models.length}` : ""})</h2>
				<select
					value={makeFilter}
					onChange={(e) => setMakeFilter(e.target.value)}
					className="rounded-md border border-border bg-white px-3 py-1.5 text-sm"
					aria-label="Filter by make"
				>
					<option value="">All makes</option>
					{makes.map((m) => (
						<option key={m.id} value={m.id}>{m.name}</option>
					))}
				</select>
			</div>
			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-left text-sm">
					<thead className="border-b border-border bg-muted-light/30">
						<tr>
							<th className="px-4 py-3 font-medium">Name</th>
							<th className="px-4 py-3 font-medium">Make</th>
							<th className="px-4 py-3 font-medium">Listings</th>
							<th className="px-4 py-3 font-medium">Actions</th>
						</tr>
					</thead>
					<tbody>
						{filtered.map((model) => (
							<tr key={model.id} className="group border-b border-border last:border-0 hover:bg-muted-light/20">
								<td className="px-4 py-3">
									<RenameCell id={model.id} name={model.name} onSave={handleRename} />
								</td>
								<td className="px-4 py-3 text-muted">{model.makeName}</td>
								<td className="px-4 py-3 text-muted">{model.listingCount}</td>
								<td className="px-4 py-3">
									<div className="flex items-center gap-3">
										<MergeCell
											id={model.id}
											options={modelOptions}
											onMerge={handleMerge}
										/>
										<DeleteButton
											id={model.id}
											disabled={model.listingCount > 0}
											disabledReason="Has listings"
											onDelete={handleDelete}
										/>
									</div>
								</td>
							</tr>
						))}
						{filtered.length === 0 && (
							<tr>
								<td colSpan={4} className="px-4 py-8 text-center text-muted">No models.</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}

// ── Page ────────────────────────────────────────────────────────────────────

function MakesPage() {
	const { makes, models } = Route.useLoaderData();

	return (
		<div className="space-y-10">
			<h1 className="text-xl font-bold text-foreground">Makes & Models</h1>
			<MakesTable makes={makes} />
			<ModelsTable models={models} makes={makes} />
		</div>
	);
}
```

- [ ] Run `pnpm typecheck` — expect no errors.

- [ ] Commit:
```bash
git add src/routes/admin/makes.tsx
git commit -m "feat: admin makes & models page"
```

---

### Task 3: Wire into admin nav

**Files:**
- Modify: `src/routes/admin/route.tsx`

- [ ] Add the `Wrench` import and nav tab to `src/routes/admin/route.tsx`:

In the import line, add `Wrench` to the lucide-react imports:
```typescript
import { BarChart3, FileText, LogOut, Shield, Users, Wrench } from "lucide-react";
```

In the `<nav>` block, add after the Users tab:
```tsx
<NavTab
    href="/admin/makes"
    label="Makes & Models"
    icon={Wrench}
    active={matchRoute({ to: "/admin/makes", fuzzy: true }) != null}
/>
```

- [ ] Run `pnpm typecheck` — expect no errors.

- [ ] Commit:
```bash
git add src/routes/admin/route.tsx
git commit -m "feat: add Makes & Models tab to admin nav"
```

---

### Task 4: Final verification

- [ ] Run `pnpm typecheck` — no errors.
- [ ] Run `pnpm lint` — no errors.
- [ ] Run `pnpm test` — no regressions.
- [ ] Start dev server (`pnpm dev`), navigate to `/admin/makes`, verify:
  - Makes table loads with model/listing counts
  - Click a make name → input appears, Enter saves, Escape cancels
  - Merge button → inline select appears with other makes, Confirm merges
  - Delete blocked on makes with models/listings
  - Models table loads, make filter works
  - Rename/merge/delete work on models
