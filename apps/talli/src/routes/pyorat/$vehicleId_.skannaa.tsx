import { Button } from "@motori/ui/button";
import { Input } from "@motori/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@motori/ui/select";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { uploadDocument } from "~/components/document-upload";
import { CornerAdjust } from "~/components/scanner/corner-adjust";
import { DOC_TYPES, MAX_SCAN_PAGES } from "~/lib/constants";
import type { DocType } from "~/lib/db/schema";
import { formErrorMessage } from "~/lib/errors";
import { type Corners, downscale, fullImageCorners } from "~/lib/scanner/geometry";
import { detectCorners, extractPage, loadScanner } from "~/lib/scanner/load-scanner";
import { getVehicleDetail } from "~/lib/vehicles";

export const Route = createFileRoute("/pyorat/$vehicleId_/skannaa")({
	loader: async ({ params, context }) => {
		if (!context.session) {
			throw redirect({ to: "/" });
		}
		return getVehicleDetail({ data: { vehicleId: params.vehicleId } });
	},
	component: ScanDocumentPage,
});

interface AdjustState {
	src: string;
	img: HTMLImageElement;
	corners: Corners;
}

interface ScannedPage {
	id: string;
	canvas: HTMLCanvasElement;
	thumb: string;
}

function ScannerStatus({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
	if (!failed) {
		return <p className="mt-4 text-sm text-muted">Ladataan skanneria…</p>;
	}
	return (
		<div className="mt-4 grid justify-items-start gap-2" data-testid="scan-load-error">
			<p className="text-sm text-destructive">Skannerin lataus epäonnistui.</p>
			<Button variant="outline" onClick={onRetry}>
				Yritä uudelleen
			</Button>
		</div>
	);
}

function ScanDocumentPage() {
	const { vehicle } = Route.useLoaderData();
	const navigate = useNavigate();
	const fileInputRef = useRef<HTMLInputElement>(null);
	// Not crypto.randomUUID(): that needs a secure context, and dev over plain
	// http://<lan-ip> (phone testing) has none. A counter is plenty for list keys.
	const pageIdRef = useRef(0);
	const [ready, setReady] = useState(false);
	const [loadFailed, setLoadFailed] = useState(false);
	const [pages, setPages] = useState<ScannedPage[]>([]);
	const [adjust, setAdjust] = useState<AdjustState | null>(null);
	const [showForm, setShowForm] = useState(false);
	const [name, setName] = useState("");
	const [docType, setDocType] = useState<DocType>("muu");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		let cancelled = false;
		loadScanner()
			.then(() => {
				if (!cancelled) {
					setReady(true);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setLoadFailed(true);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	async function retryLoad() {
		setLoadFailed(false);
		try {
			await loadScanner();
			setReady(true);
		} catch {
			setLoadFailed(true);
		}
	}

	// Revoke the photo's object URL if the user leaves the adjust screen without
	// accepting or cancelling (e.g. browser back).
	const adjustSrc = adjust?.src;
	useEffect(() => {
		if (!adjustSrc) {
			return;
		}
		return () => URL.revokeObjectURL(adjustSrc);
	}, [adjustSrc]);

	async function handleFile(file: File | undefined) {
		if (!file) {
			return;
		}
		if (pages.length >= MAX_SCAN_PAGES) {
			toast.error(`Enintään ${MAX_SCAN_PAGES} sivua.`);
			return;
		}
		setBusy(true);
		const src = URL.createObjectURL(file);
		try {
			const img = new Image();
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () => reject(new Error("Kuvan avaus epäonnistui"));
				img.src = src;
			});
			const corners = await detectCorners(img);
			setAdjust({ src, img, corners });
		} catch (err) {
			URL.revokeObjectURL(src);
			toast.error(formErrorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	async function acceptPage(corners: Corners) {
		if (!adjust) {
			return;
		}
		setBusy(true);
		try {
			const canvas = await extractPage(adjust.img, corners);
			const thumb = downscale(canvas, 240).toDataURL("image/jpeg", 0.7);
			pageIdRef.current += 1;
			const id = String(pageIdRef.current);
			setPages((prev) => [...prev, { id, canvas, thumb }]);
			setAdjust(null);
		} catch (err) {
			toast.error(formErrorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	function cancelAdjust() {
		setAdjust(null);
	}

	async function handleSave(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		try {
			const { pagesToPdf } = await import("~/lib/scanner/pdf");
			const pdf = await pagesToPdf(pages.map((p) => p.canvas));
			await uploadDocument({
				file: pdf,
				filename: "skannaus.pdf",
				vehicleId: vehicle.id,
				name,
				docType,
			});
			toast.success("Dokumentti tallennettu.");
			navigate({ to: "/pyorat/$vehicleId", params: { vehicleId: vehicle.id } });
		} catch (err) {
			// Pages stay in state — retry doesn't mean re-scanning.
			toast.error(formErrorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	if (adjust) {
		return (
			<div className="mx-auto max-w-lg" data-testid="scan-adjust">
				<h1 className="font-heading text-2xl font-bold">Rajaa sivu</h1>
				<p className="mt-1 text-sm text-muted">Vedä kulmat dokumentin reunoille.</p>
				<div className="mt-4">
					<CornerAdjust
						src={adjust.src}
						width={adjust.img.naturalWidth}
						height={adjust.img.naturalHeight}
						corners={adjust.corners}
						onChange={(corners) => setAdjust({ ...adjust, corners })}
					/>
				</div>
				<div className="mt-4 grid gap-2">
					<Button
						data-testid="accept-page"
						disabled={busy}
						onClick={() => acceptPage(adjust.corners)}
					>
						Hyväksy sivu
					</Button>
					<Button
						variant="outline"
						disabled={busy}
						onClick={() =>
							acceptPage(fullImageCorners(adjust.img.naturalWidth, adjust.img.naturalHeight))
						}
					>
						Käytä koko kuvaa
					</Button>
					<Button variant="outline" disabled={busy} onClick={cancelAdjust}>
						Peruuta
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-lg" data-testid="scan-page">
			<Link
				to="/pyorat/$vehicleId"
				params={{ vehicleId: vehicle.id }}
				className="text-sm text-muted hover:text-foreground"
			>
				← Takaisin
			</Link>
			<h1 className="mt-2 font-heading text-2xl font-bold">Skannaa dokumentti</h1>

			{!ready ? <ScannerStatus failed={loadFailed} onRetry={retryLoad} /> : null}

			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				capture="environment"
				className="sr-only"
				data-testid="scan-file-input"
				onChange={(e) => {
					handleFile(e.target.files?.[0]);
					e.target.value = "";
				}}
			/>

			{pages.length > 0 ? (
				<div className="mt-4 flex flex-wrap gap-2" data-testid="scan-pages">
					{pages.map((p, i) => (
						<button
							key={p.id}
							type="button"
							title="Poista sivu"
							onClick={() => setPages((prev) => prev.filter((_, j) => j !== i))}
						>
							<img
								src={p.thumb}
								alt={`Sivu ${i + 1}`}
								className="h-24 rounded border border-border object-cover"
							/>
						</button>
					))}
				</div>
			) : null}

			{!showForm ? (
				<div className="mt-6 grid gap-2">
					<Button
						data-testid="scan-capture"
						disabled={!ready || busy}
						onClick={() => fileInputRef.current?.click()}
					>
						{pages.length === 0 ? "Ota kuva" : "Lisää sivu"}
					</Button>
					{pages.length > 0 ? (
						<Button variant="outline" data-testid="scan-done" onClick={() => setShowForm(true)}>
							Valmis ({pages.length} {pages.length === 1 ? "sivu" : "sivua"})
						</Button>
					) : null}
				</div>
			) : (
				<form onSubmit={handleSave} className="mt-6 grid gap-4" data-testid="scan-save-form">
					<label htmlFor="doc-name" className="grid gap-1 text-sm font-medium">
						Nimi *
						<Input
							id="doc-name"
							data-testid="doc-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={100}
							required
						/>
					</label>
					<label htmlFor="doc-type" className="grid gap-1 text-sm font-medium">
						Tyyppi
						<Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
							<SelectTrigger id="doc-type" data-testid="doc-type">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DOC_TYPES.map((t) => (
									<SelectItem key={t.key} value={t.key}>
										{t.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</label>
					<Button type="submit" data-testid="doc-save" disabled={busy || !name.trim()}>
						{busy ? "Tallennetaan…" : `Tallenna PDF (${pages.length} sivua)`}
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={busy}
						onClick={() => setShowForm(false)}
					>
						Takaisin
					</Button>
				</form>
			)}
		</div>
	);
}
