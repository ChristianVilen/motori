// src/components/auth/login-modal.tsx
// Lightweight login modal for quick sign-in from the nav.
import { Link, useRouter } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect } from "react";
import { LoginForm } from "~/components/auth/login-form";

interface LoginModalProps {
	open: boolean;
	onClose: () => void;
}

export function LoginModal({ open, onClose }: LoginModalProps) {
	const router = useRouter();

	useEffect(() => {
		if (!open) {
			return;
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				onClose();
			}
		}
		window.addEventListener("keydown", onKey);
		document.body.style.overflow = "hidden";
		return () => {
			window.removeEventListener("keydown", onKey);
			document.body.style.overflow = "";
		};
	}, [open, onClose]);

	if (!open) {
		return null;
	}

	function handleSuccess() {
		router.invalidate();
		onClose();
	}

	return (
		<div
			data-testid="login-modal"
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			onClick={onClose}
			onKeyDown={(e) => e.key === "Escape" && onClose()}
			role="dialog"
			aria-modal="true"
			aria-labelledby="login-modal-title"
		>
			<div
				className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				role="document"
			>
				<div className="mb-5 flex items-start justify-between">
					<div>
						<h2 id="login-modal-title" className="text-lg font-bold text-primary">
							Kirjaudu sisään
						</h2>
						<p className="mt-0.5 text-xs text-muted">Vuokramoto</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Sulje"
						className="rounded p-1 text-muted hover:bg-muted-light hover:text-foreground"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<LoginForm onSuccess={handleSuccess} />

				<p className="mt-4 text-center text-sm text-muted">
					Ei tiliä?{" "}
					<Link to="/auth/register" onClick={onClose} className="text-accent hover:underline">
						Rekisteröidy
					</Link>
				</p>
			</div>
		</div>
	);
}
