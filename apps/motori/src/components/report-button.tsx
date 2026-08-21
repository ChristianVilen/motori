import { Flag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { parseAppError } from "~/lib/errors-client";
import { useTranslation } from "~/lib/i18n";
import { submitReport } from "~/lib/reports";
import { useFocusTrap } from "~/lib/use-focus-trap";

interface ReportButtonProps {
	targetType: "listing" | "user";
	targetId: string;
}

export function ReportButton({ targetType, targetId }: ReportButtonProps) {
	const { t } = useTranslation("common");
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState("");
	const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
	const dialogRef = useFocusTrap(open);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!reason.trim()) {
			return;
		}
		setStatus("submitting");
		try {
			await submitReport({
				data: { targetType, targetId, reason: reason.trim() },
			});
			toast.success(t("report.success"));
			handleClose();
		} catch (err: unknown) {
			const parsed = parseAppError(err);
			if (parsed?.code === "report.already_reported") {
				toast.info(t("report.duplicate"));
				handleClose();
				return;
			}
			setStatus("error");
		}
	}

	function handleClose() {
		setOpen(false);
		setReason("");
		setStatus("idle");
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex items-center gap-1 text-xs text-muted hover:text-destructive"
			>
				<Flag size={12} />
				{t("report.button")}
			</button>

			{open ? (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
					onClick={(e) => e.target === e.currentTarget && handleClose()}
					onKeyDown={(e) => e.key === "Escape" && handleClose()}
					role="none"
				>
					<div
						ref={dialogRef}
						role="dialog"
						aria-modal="true"
						aria-label={t("report.modalTitle")}
						className="w-full max-w-md rounded-l bg-white p-6 shadow-lg"
					>
						<form onSubmit={handleSubmit}>
							<h2 className="mb-4 text-lg font-semibold text-foreground">
								{t("report.modalTitle")}
							</h2>
							<label htmlFor="report-reason" className="sr-only">
								{t("report.reasonLabel")}
							</label>
							<textarea
								id="report-reason"
								value={reason}
								onChange={(e) => setReason(e.target.value)}
								placeholder={t("report.placeholder")}
								maxLength={1000}
								rows={4}
								required
								className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none"
							/>
							{status === "error" && (
								<p className="mt-2 text-xs text-destructive">{t("errors.generic")}</p>
							)}
							<div className="mt-4 flex justify-end gap-2">
								<button
									type="button"
									onClick={handleClose}
									className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted-light"
								>
									{t("actions.cancel")}
								</button>
								<button
									type="submit"
									disabled={status === "submitting" || !reason.trim()}
									className="rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
								>
									{status === "submitting" ? t("report.submitting") : t("report.submit")}
								</button>
							</div>
						</form>
					</div>
				</div>
			) : null}
		</>
	);
}
