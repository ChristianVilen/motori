// pdf-lib is dynamic-import'ed so it stays out of the main bundle.
export async function pagesToPdf(pages: HTMLCanvasElement[]): Promise<Blob> {
	const { PDFDocument } = await import("pdf-lib");
	const pdf = await PDFDocument.create();
	for (const canvas of pages) {
		const blob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error("Sivun pakkaus epäonnistui"))),
				"image/jpeg",
				0.8,
			);
		});
		const jpg = await pdf.embedJpg(await blob.arrayBuffer());
		const page = pdf.addPage([jpg.width, jpg.height]);
		page.drawImage(jpg, { x: 0, y: 0, width: jpg.width, height: jpg.height });
	}
	const bytes = await pdf.save();
	return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
