// src/components/auth/login-modal.tsx
// Lightweight login modal for quick sign-in from the nav.
import { Link, useRouter } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect } from "react";
import { LoginForm } from "~/components/auth/login-form";
import { useTranslation } from "~/lib/i18n";
import { useFocusTrap } from "~/lib/use-focus-trap";

interface LoginModalProps {
	open: boolean;
	onClose: () => void;
}

export function LoginModal({ open, onClose }: LoginModalProps) {
	const router = useRouter();
	const { t } = useTranslation("auth");
	const trapRef = useFocusTrap(open);

	useEffect(() => {
		if (!open) {
			return;
		}
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "";
		};
	}, [open]);

	if (!open) {
		return null;
	}

	async function handleSuccess() {
		router.invalidate();
		onClose();
	}
	return (
		<div
			data-testid="login-modal"
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			onClick={(event) => {
				if (event.target === event.currentTarget) {
					onClose();
				}
			}}
			onKeyDown={(e) => e.key === "Escape" && onClose()}
			role="dialog"
			aria-modal="true"
			aria-labelledby="login-modal-title"
		>
			<div
				ref={trapRef}
				className="w-full max-w-md rounded-sheet border border-border bg-card p-6 shadow-xl"
				role="document"
			>
				<div className="mb-5 flex items-start justify-between">
					<h2 id="login-modal-title" className="text-lg font-bold text-primary">
						{t("modal.heading")}
					</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label={t("modal.closeLabel")}
						className="grid size-11 place-items-center rounded-full text-muted hover:bg-muted-light hover:text-foreground"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<LoginForm onSuccess={handleSuccess} />

				<p className="mt-4 text-center text-sm text-muted">
					{t("modal.noAccount")}{" "}
					<Link to="/rekisteroidy" onClick={onClose} className="text-foreground underline">
						{t("modal.registerLink")}
					</Link>
				</p>
			</div>
		</div>
	);
}
