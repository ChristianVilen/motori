import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "~/lib/i18n";

export interface MobileFullscreenModalProps {
	open: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
}

export function MobileFullscreenModal({
	open,
	onClose,
	title,
	children,
}: MobileFullscreenModalProps) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) {
			return;
		}
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);

	useEffect(() => {
		if (!open) {
			return;
		}
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				onClose();
			}
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [open, onClose]);

	if (!mounted || !open) {
		return null;
	}

	const { t } = useTranslation("listings");

	return createPortal(
		<div
			role="dialog"
			aria-modal="true"
			aria-label={title}
			className="fixed inset-0 z-50 flex flex-col bg-background"
		>
			<div className="flex items-center justify-between border-b border-border px-4 py-3">
				<h2 className="text-sm font-semibold text-foreground">{title}</h2>
				<button
					type="button"
					onClick={onClose}
					className="rounded-lg p-1.5 text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
					aria-label={t("detail.back")}
				>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
						<path
							d="M6 6l8 8M14 6l-8 8"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
						/>
					</svg>
				</button>
			</div>
			<div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
		</div>,
		document.body,
	);
}
