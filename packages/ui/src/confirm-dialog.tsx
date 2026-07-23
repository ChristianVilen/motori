import { useEffect, useRef } from "react";

import { Button } from "./button";

export interface ConfirmDialogProps {
	open: boolean;
	title: string;
	confirmLabel: string;
	cancelLabel: string;
	destructive?: boolean;
	busy?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

/** Modal confirmation built on the native <dialog> element — showModal() gives
 *  the focus trap, Escape handling, and backdrop without a dependency. */
export function ConfirmDialog({
	open,
	title,
	confirmLabel,
	cancelLabel,
	destructive = false,
	busy = false,
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) {
			return;
		}
		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	}, [open]);

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click-to-dismiss; Escape is handled natively by <dialog>.
		<dialog
			ref={ref}
			data-testid="confirm-dialog"
			// close fires on Escape and on the effect's close() — calling onCancel
			// after a confirm is idempotent (the parent has already cleared its state).
			onClose={onCancel}
			// Clicks on ::backdrop target the <dialog> element itself; content clicks
			// land on the inner div (the dialog has no padding of its own).
			onClick={(e) => {
				if (e.target === ref.current) {
					onCancel();
				}
			}}
			className="m-auto w-full max-w-sm rounded-lg border border-border bg-background p-0 text-foreground backdrop:bg-black/50"
		>
			<div className="p-6">
				<p className="text-sm font-medium">{title}</p>
				<div className="mt-4 flex justify-end gap-2">
					<Button variant="outline" size="sm" disabled={busy} onClick={onCancel}>
						{cancelLabel}
					</Button>
					<Button
						variant={destructive ? "destructive" : "default"}
						size="sm"
						disabled={busy}
						data-testid="confirm-dialog-confirm"
						onClick={onConfirm}
					>
						{confirmLabel}
					</Button>
				</div>
			</div>
		</dialog>
	);
}
