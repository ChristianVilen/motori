import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createMake, createModel, getMakes, getModels } from "~/lib/makes";

interface Make {
	id: string;
	name: string;
	slug: string;
}
interface Model {
	id: string;
	name: string;
}

interface MakeModelSelectProps {
	initialMakeId?: string | null;
	initialModelId?: string | null;
	onMakeChange: (makeId: string) => void;
	onModelChange: (modelId: string | null) => void;
	makeError?: unknown;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: combobox with add-new flow
export function MakeModelSelect({
	initialMakeId,
	initialModelId,
	onMakeChange,
	onModelChange,
	makeError,
}: MakeModelSelectProps) {
	const [makes, setMakes] = useState<Make[]>([]);
	const [models, setModels] = useState<Model[]>([]);
	const [selectedMake, setSelectedMake] = useState<Make | null>(null);
	const [selectedModel, setSelectedModel] = useState<Model | null>(null);
	const [makeFilter, setMakeFilter] = useState("");
	const [modelFilter, setModelFilter] = useState("");
	const [makeOpen, setMakeOpen] = useState(false);
	const [modelOpen, setModelOpen] = useState(false);
	const [makeAddingNew, setMakeAddingNew] = useState(false);
	const [modelAddingNew, setModelAddingNew] = useState(false);
	const [newMakeName, setNewMakeName] = useState("");
	const [newModelName, setNewModelName] = useState("");
	const [makeLoading, setMakeLoading] = useState(false);
	const [modelLoading, setModelLoading] = useState(false);
	const [makeAddError, setMakeAddError] = useState<string | null>(null);
	const [modelAddError, setModelAddError] = useState<string | null>(null);

	const makeRef = useRef<HTMLDivElement>(null);
	const modelRef = useRef<HTMLDivElement>(null);
	const initialMakeIdRef = useRef(initialMakeId);
	const initialModelIdRef = useRef(initialModelId);
	const onMakeChangeRef = useRef(onMakeChange);
	const onModelChangeRef = useRef(onModelChange);

	useEffect(() => {
		getMakes().then((loadedMakes) => {
			setMakes(loadedMakes);
			const makeId = initialMakeIdRef.current;
			if (!makeId) {
				return;
			}
			const initialMake = loadedMakes.find((m) => m.id === makeId);
			if (!initialMake) {
				return;
			}
			setSelectedMake(initialMake);
			onMakeChangeRef.current(initialMake.id);
			getModels({ data: makeId }).then((loadedModels) => {
				setModels(loadedModels);
				const modelId = initialModelIdRef.current;
				if (!modelId) {
					return;
				}
				const initialModel = loadedModels.find((m) => m.id === modelId);
				if (!initialModel) {
					return;
				}
				setSelectedModel(initialModel);
				onModelChangeRef.current(initialModel.id);
			});
		});
	}, []);

	useEffect(() => {
		function onClickOutside(e: MouseEvent) {
			if (makeRef.current && !makeRef.current.contains(e.target as Node)) {
				setMakeOpen(false);
				setMakeFilter("");
				setMakeAddingNew(false);
				setNewMakeName("");
			}
		}
		document.addEventListener("mousedown", onClickOutside);
		return () => document.removeEventListener("mousedown", onClickOutside);
	}, []);

	useEffect(() => {
		function onClickOutside(e: MouseEvent) {
			if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
				setModelOpen(false);
				setModelFilter("");
				setModelAddingNew(false);
				setNewModelName("");
			}
		}
		document.addEventListener("mousedown", onClickOutside);
		return () => document.removeEventListener("mousedown", onClickOutside);
	}, []);

	const filteredMakes = makes.filter((m) =>
		m.name.toLowerCase().includes(makeFilter.toLowerCase()),
	);
	const filteredModels = models.filter((m) =>
		m.name.toLowerCase().includes(modelFilter.toLowerCase()),
	);

	function handleMakeSelect(make: Make) {
		setSelectedMake(make);
		setMakeOpen(false);
		setMakeFilter("");
		setMakeAddingNew(false);
		setNewMakeName("");
		onMakeChange(make.id);
		setSelectedModel(null);
		setModels([]);
		setModelFilter("");
		onModelChange(null);
		getModels({ data: make.id }).then(setModels);
	}

	function handleModelSelect(model: Model) {
		setSelectedModel(model);
		setModelOpen(false);
		setModelFilter("");
		setModelAddingNew(false);
		setNewModelName("");
		onModelChange(model.id);
	}

	async function handleAddMake() {
		if (!newMakeName.trim()) {
			return;
		}
		setMakeLoading(true);
		setMakeAddError(null);
		try {
			const newMake = await createMake({ data: newMakeName.trim() });
			setMakes((prev) => [...prev, newMake].sort((a, b) => a.name.localeCompare(b.name)));
			handleMakeSelect(newMake);
		} catch (err) {
			setMakeAddError(err instanceof Error ? err.message : "Virhe lisättäessä merkkiä");
		} finally {
			setMakeLoading(false);
		}
	}

	async function handleAddModel() {
		if (!selectedMake || !newModelName.trim()) {
			return;
		}
		setModelLoading(true);
		setModelAddError(null);
		try {
			const newModel = await createModel({
				data: { makeId: selectedMake.id, name: newModelName.trim() },
			});
			setModels((prev) => [...prev, newModel].sort((a, b) => a.name.localeCompare(b.name)));
			handleModelSelect(newModel);
		} catch (err) {
			setModelAddError(err instanceof Error ? err.message : "Virhe lisättäessä mallia");
		} finally {
			setModelLoading(false);
		}
	}

	const triggerClass =
		"flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

	const dropdownClass =
		"absolute left-0 top-full z-10 mt-1 w-max min-w-full rounded-md border border-border bg-card shadow-lg";

	const filterInputClass =
		"w-full rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-accent";

	const addInputClass =
		"flex-1 rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-accent";

	return (
		<div className="grid grid-cols-2 gap-4">
			{/* ── Make ────────────────────────────────────────────────────────── */}
			<div ref={makeRef} className="relative">
				<label htmlFor="make-trigger" className="mb-1 block text-sm font-medium text-foreground">
					Merkki <span className="text-destructive">*</span>
				</label>
				<button
					id="make-trigger"
					type="button"
					onClick={() => {
						setMakeOpen((prev) => !prev);
						setMakeFilter("");
					}}
					className={triggerClass}
				>
					<span className={selectedMake ? "text-foreground" : "text-muted"}>
						{selectedMake?.name ?? "Valitse merkki"}
					</span>
					<ChevronDown className="h-4 w-4 shrink-0 text-muted" />
				</button>

				{makeOpen ? (
					<div className={dropdownClass}>
						<div className="p-2">
							<input
								type="text"
								// biome-ignore lint/a11y/noAutofocus: intentional — focus filter on dropdown open
								autoFocus
								value={makeFilter}
								onChange={(e) => setMakeFilter(e.target.value)}
								placeholder="Hae..."
								className={filterInputClass}
							/>
						</div>
						<ul className="max-h-52 overflow-y-auto">
							{filteredMakes.map((make) => (
								<li key={make.id}>
									<button
										type="button"
										onClick={() => handleMakeSelect(make)}
										className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted-light"
									>
										{make.name}
									</button>
								</li>
							))}
							{filteredMakes.length === 0 && (
								<li className="px-3 py-2 text-sm text-muted">Ei tuloksia</li>
							)}
						</ul>
						<div className="border-t border-border p-2">
							{makeAddingNew ? (
								<>
									<div className="flex items-center gap-2">
										<input
											type="text"
											// biome-ignore lint/a11y/noAutofocus: intentional — focus add input
											autoFocus
											value={newMakeName}
											onChange={(e) => setNewMakeName(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													handleAddMake();
												}
											}}
											placeholder="Merkin nimi..."
											className={addInputClass}
										/>
										<button
											type="button"
											onClick={handleAddMake}
											disabled={makeLoading || !newMakeName.trim()}
											className="rounded bg-accent px-3 py-1 text-sm text-white disabled:opacity-50"
										>
											Lisää
										</button>
										<button
											type="button"
											onClick={() => {
												setMakeAddingNew(false);
												setNewMakeName("");
												setMakeAddError(null);
											}}
											className="text-sm text-muted hover:text-foreground"
										>
											Peruuta
										</button>
									</div>
									{makeAddError !== null ? (
										<p className="mt-1 text-sm text-destructive">{makeAddError}</p>
									) : null}
								</>
							) : (
								<button
									type="button"
									onClick={() => setMakeAddingNew(true)}
									className="flex items-center gap-1 text-sm text-accent hover:underline"
								>
									<Plus className="h-3 w-3" />
									Ei löydy listalta — lisää uusi
								</button>
							)}
						</div>
					</div>
				) : null}

				{makeError != null && (
					<p className="mt-1 text-sm text-destructive">
						{typeof makeError === "string" ? makeError : String(makeError)}
					</p>
				)}
			</div>

			{/* ── Model ───────────────────────────────────────────────────────── */}
			<div ref={modelRef} className="relative">
				<label
					htmlFor="model-trigger"
					className={`mb-1 block text-sm font-medium ${selectedMake ? "text-foreground" : "text-muted"}`}
				>
					Malli
				</label>
				<button
					id="model-trigger"
					type="button"
					disabled={!selectedMake}
					onClick={() => {
						setModelOpen((prev) => !prev);
						setModelFilter("");
					}}
					className={`${triggerClass} disabled:cursor-not-allowed disabled:opacity-50`}
				>
					<span className={selectedModel ? "text-foreground" : "text-muted"}>
						{selectedModel?.name ??
							(selectedMake ? "Valitse malli (vapaaehtoinen)" : "Valitse ensin merkki")}
					</span>
					<ChevronDown className="h-4 w-4 shrink-0 text-muted" />
				</button>

				{modelOpen ? (
					<div className={dropdownClass}>
						<div className="p-2">
							<input
								type="text"
								// biome-ignore lint/a11y/noAutofocus: intentional
								autoFocus
								value={modelFilter}
								onChange={(e) => setModelFilter(e.target.value)}
								placeholder="Hae..."
								className={filterInputClass}
							/>
						</div>
						<ul className="max-h-52 overflow-y-auto">
							{selectedModel !== null ? (
								<li>
									<button
										type="button"
										onClick={() => {
											setSelectedModel(null);
											onModelChange(null);
											setModelOpen(false);
										}}
										className="w-full px-3 py-2 text-left text-sm text-muted hover:bg-muted-light"
									>
										(tyhjennä valinta)
									</button>
								</li>
							) : null}
							{filteredModels.map((model) => (
								<li key={model.id}>
									<button
										type="button"
										onClick={() => handleModelSelect(model)}
										className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted-light"
									>
										{model.name}
									</button>
								</li>
							))}
							{filteredModels.length === 0 && (
								<li className="px-3 py-2 text-sm text-muted">Ei malleja — lisää uusi</li>
							)}
						</ul>
						<div className="border-t border-border p-2">
							{modelAddingNew ? (
								<>
									<div className="flex items-center gap-2">
										<input
											type="text"
											// biome-ignore lint/a11y/noAutofocus: intentional
											autoFocus
											value={newModelName}
											onChange={(e) => setNewModelName(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													handleAddModel();
												}
											}}
											placeholder="Mallin nimi..."
											className={addInputClass}
										/>
										<button
											type="button"
											onClick={handleAddModel}
											disabled={modelLoading || !newModelName.trim()}
											className="rounded bg-accent px-3 py-1 text-sm text-white disabled:opacity-50"
										>
											Lisää
										</button>
										<button
											type="button"
											onClick={() => {
												setModelAddingNew(false);
												setNewModelName("");
												setModelAddError(null);
											}}
											className="text-sm text-muted hover:text-foreground"
										>
											Peruuta
										</button>
									</div>
									{modelAddError !== null ? (
										<p className="mt-1 text-sm text-destructive">{modelAddError}</p>
									) : null}
								</>
							) : (
								<button
									type="button"
									onClick={() => setModelAddingNew(true)}
									className="flex items-center gap-1 text-sm text-accent hover:underline"
								>
									<Plus className="h-3 w-3" />
									Ei löydy listalta — lisää uusi
								</button>
							)}
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
