import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GitMerge, Pencil, Sparkles, Trash2 } from "lucide-react";
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

const NEW_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

function isNew(createdAt: Date) {
	return Date.now() - new Date(createdAt).getTime() < NEW_THRESHOLD_MS;
}

export const Route = createFileRoute("/admin/makes")({
	loader: async () => {
		const [makes, models] = await Promise.all([getAdminMakes(), getAdminModels({ data: null })]);
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
	const [saving, setSaving] = useState(false);

	async function save() {
		if (saving || value.trim() === name) {
			setEditing(false);
			return;
		}
		setSaving(true);
		try {
			await onSave(id, value.trim());
			setEditing(false);
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Error");
		} finally {
			setSaving(false);
		}
	}

	if (!editing) {
		return (
			<button
				type="button"
				onClick={() => {
					setValue(name);
					setEditing(true);
				}}
				className="group/rename flex items-center gap-1.5 text-left hover:text-accent"
				title="Click to rename"
			>
				{name}
				<Pencil
					size={12}
					className="shrink-0 text-muted opacity-0 group-hover/rename:opacity-100"
				/>
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
					if (e.key === "Enter") {
						save();
					}
					if (e.key === "Escape") {
						setEditing(false);
					}
				}}
				onBlur={() => {
					if (!saving) {
						save();
					}
				}}
				className="rounded border border-input bg-background px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
			/>
			{error ? <span className="text-xs text-destructive">{error}</span> : null}
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

	if (others.length === 0) {
		return null;
	}

	async function confirm() {
		if (!targetId) {
			return;
		}
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
				onClick={() => {
					setTargetId(others[0]?.id ?? "");
					setOpen(true);
				}}
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
						<option key={o.id} value={o.id}>
							{o.label}
						</option>
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
			{error ? <span className="text-xs text-destructive">{error}</span> : null}
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
			{error ? <span className="text-xs text-destructive">{error}</span> : null}
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
							<tr
								key={make.id}
								className={`group border-b border-border last:border-0 hover:bg-muted-light/20 ${isNew(make.createdAt) ? "bg-yellow-50" : ""}`}
							>
								<td className="px-4 py-3">
									<span className="flex items-center gap-2">
										<RenameCell id={make.id} name={make.name} onSave={handleRename} />
										{isNew(make.createdAt) && (
											<Sparkles size={13} className="shrink-0 text-yellow-500" />
										)}
									</span>
								</td>
								<td className="px-4 py-3 text-muted">{make.modelCount}</td>
								<td className="px-4 py-3 text-muted">{make.listingCount}</td>
								<td className="px-4 py-3">
									<div className="flex items-center gap-3">
										<MergeCell id={make.id} options={makeOptions} onMerge={handleMerge} />
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
								<td colSpan={4} className="px-4 py-8 text-center text-muted">
									No makes.
								</td>
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
				<h2 className="text-base font-semibold text-foreground">
					Models ({filtered.length}
					{makeFilter ? ` of ${models.length}` : ""})
				</h2>
				<select
					value={makeFilter}
					onChange={(e) => setMakeFilter(e.target.value)}
					className="rounded-md border border-border bg-white px-3 py-1.5 text-sm"
					aria-label="Filter by make"
				>
					<option value="">All makes</option>
					{makes.map((m) => (
						<option key={m.id} value={m.id}>
							{m.name}
						</option>
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
							<tr
								key={model.id}
								className={`group border-b border-border last:border-0 hover:bg-muted-light/20 ${isNew(model.createdAt) ? "bg-yellow-50" : ""}`}
							>
								<td className="px-4 py-3">
									<span className="flex items-center gap-2">
										<RenameCell id={model.id} name={model.name} onSave={handleRename} />
										{isNew(model.createdAt) && (
											<Sparkles size={13} className="shrink-0 text-yellow-500" />
										)}
									</span>
								</td>
								<td className="px-4 py-3 text-muted">{model.makeName}</td>
								<td className="px-4 py-3 text-muted">{model.listingCount}</td>
								<td className="px-4 py-3">
									<div className="flex items-center gap-3">
										<MergeCell id={model.id} options={modelOptions} onMerge={handleMerge} />
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
								<td colSpan={4} className="px-4 py-8 text-center text-muted">
									No models.
								</td>
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
