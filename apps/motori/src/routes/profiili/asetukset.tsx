// src/routes/profiili/asetukset.tsx
// Profile settings — edit name, city, phone visibility, license class.

import { passwordStrength } from "@motori/server/password-strength";
import { Button } from "@motori/ui/button";
import { Input } from "@motori/ui/input";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CitySelect } from "~/components/listings/city-select";
import { authClient } from "~/lib/auth-client";
import { SITE_NAME } from "~/lib/constants";
import { exportMyData } from "~/lib/data-export";
import { deleteAccount } from "~/lib/delete-account";
import { AppError } from "~/lib/errors";
import { useTranslation } from "~/lib/i18n";
import { csrfOnly } from "~/lib/middleware";
import { getProfileForEdit, updateSettings } from "~/lib/profile.server";
import { requireSession, requireSessionOrRedirect, requireUserId } from "~/lib/session";
import { validateFinnishPhone } from "~/lib/validators";

const loadSettings = createServerFn({ method: "GET" }).handler(async () => {
	const session = await requireSession();
	const profile = await getProfileForEdit(session.user.id);
	return { profile, session };
});

const saveSettings = createServerFn({ method: "POST" })
	.middleware(csrfOnly())
	.inputValidator(
		(data: { displayName: string; city: string; phone: string; showPhone: boolean }) => {
			const displayName = data.displayName.trim();
			if (!displayName) {
				throw new AppError("profile.display_name_required", { field: "displayName" });
			}
			const phone = validateFinnishPhone(data.phone);
			return {
				displayName,
				city: data.city.trim(),
				phone,
				showPhone: data.showPhone,
			};
		},
	)
	.handler(async ({ data }) => {
		await updateSettings(await requireUserId(), data);
	});

export const Route = createFileRoute("/profiili/asetukset")({
	loader: async () => {
		await requireSessionOrRedirect();
		return loadSettings();
	},
	head: () => ({
		meta: [{ title: `Asetukset — ${SITE_NAME}` }],
	}),
	component: SettingsPage,
});

function SettingsPage() {
	const { t } = useTranslation("profile");
	const { profile, session } = Route.useLoaderData();
	const navigate = useNavigate();
	const [displayName, setDisplayName] = useState(profile?.display_name ?? session.user.name ?? "");
	const [city, setCity] = useState(profile?.city ?? "");
	const [phone, setPhone] = useState(profile?.phone ?? "");
	const [showPhone, setShowPhone] = useState(profile?.show_phone ?? false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSaved(false);
		setLoading(true);
		try {
			await saveSettings({
				data: { displayName, city, phone, showPhone },
			});
			setSaved(true);
		} catch {
			setError(t("settings.saveError"));
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-lg px-4 py-8">
				<div className="mb-6">
					<Link to="/omat" className="text-sm text-muted hover:text-foreground">
						{t("settings.backLink")}
					</Link>
					<h1 className="mt-2 text-2xl font-bold text-primary">{t("settings.pageTitle")}</h1>
					<p className="mt-1 text-sm text-muted">{session.user.email}</p>
				</div>

				<form
					onSubmit={handleSubmit}
					className="space-y-5 rounded-l border border-border bg-card p-5"
				>
					<div className="space-y-2">
						<label htmlFor="displayName" className="text-sm font-medium text-foreground">
							{t("settings.displayNameLabel")} <span className="text-destructive">*</span>
						</label>
						<Input
							id="displayName"
							required
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							placeholder="Matti M."
						/>
					</div>

					<div className="space-y-2">
						<label htmlFor="city" className="text-sm font-medium text-foreground">
							{t("settings.cityLabel")}
						</label>
						<CitySelect
							id="city"
							value={city}
							onChange={(newCity) => setCity(newCity)}
							placeholder="Helsinki"
						/>
					</div>

					<div className="space-y-2">
						<label htmlFor="phone" className="text-sm font-medium text-foreground">
							{t("settings.phoneLabel")}
						</label>
						<Input
							id="phone"
							type="tel"
							value={phone}
							onChange={(e) => setPhone(e.target.value)}
							placeholder="+358 40 123 4567"
						/>
						<label className="flex items-center gap-2 text-sm text-muted">
							<input
								type="checkbox"
								checked={showPhone}
								onChange={(e) => setShowPhone(e.target.checked)}
								className="h-4 w-4"
							/>
							{t("settings.showPhoneLabel")}
						</label>
					</div>

					<div className="flex items-center gap-3 pt-2">
						<Button
							type="submit"
							className="bg-accent text-white hover:bg-accent-hover"
							disabled={loading || !displayName.trim()}
						>
							{loading ? t("settings.saving") : t("settings.save")}
						</Button>
						<Button type="button" variant="outline" onClick={() => navigate({ to: "/omat" })}>
							{t("settings.cancel")}
						</Button>
						{!!saved && <span className="text-sm text-success">{t("settings.saved")}</span>}
						{!!error && <span className="text-sm text-destructive">{error}</span>}
					</div>
				</form>

				<ChangePasswordSection />
				<DataExportSection />
				<DeleteAccountSection />
			</div>
		</div>
	);
}

function ChangePasswordSection() {
	const { t } = useTranslation("profile");
	const { t: tAuth } = useTranslation("auth");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const strength = passwordStrength(newPassword);

	useEffect(() => {
		if (!success) {
			return;
		}
		const id = setTimeout(() => setSuccess(false), 4000);
		return () => clearTimeout(id);
	}, [success]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSuccess(false);

		if (newPassword !== confirm) {
			setError(t("settings.changePasswordErrorMismatch"));
			return;
		}

		setLoading(true);
		try {
			const result = await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions: true,
			});
			if (result.error) {
				setError(
					result.error.code === "INVALID_PASSWORD"
						? t("settings.changePasswordErrorWrong")
						: t("settings.changePasswordError"),
				);
				return;
			}
			setSuccess(true);
			setCurrentPassword("");
			setNewPassword("");
			setConfirm("");
		} catch {
			setError(t("settings.changePasswordError"));
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="mt-6 rounded-l border border-border bg-card p-5">
			<h2 className="text-lg font-bold text-primary">{t("settings.changePasswordHeading")}</h2>
			<form onSubmit={handleSubmit} className="mt-4 space-y-4">
				<div className="space-y-2">
					<label htmlFor="currentPassword" className="text-sm font-medium text-foreground">
						{t("settings.currentPasswordLabel")}
					</label>
					<Input
						id="currentPassword"
						type="password"
						autoComplete="current-password"
						required
						value={currentPassword}
						onChange={(e) => setCurrentPassword(e.target.value)}
					/>
				</div>

				<div className="space-y-2">
					<label htmlFor="newPassword" className="text-sm font-medium text-foreground">
						{t("settings.newPasswordLabel")}
					</label>
					<Input
						id="newPassword"
						type="password"
						autoComplete="new-password"
						required
						minLength={8}
						value={newPassword}
						onChange={(e) => setNewPassword(e.target.value)}
					/>
					{newPassword.length > 0 && (
						<div className="space-y-1">
							<div className="flex gap-1">
								{[1, 2, 3, 4, 5].map((i) => (
									<div
										key={i}
										className={`h-1 flex-1 rounded-full transition-colors ${
											i <= strength.score ? strength.color : "bg-border"
										}`}
									/>
								))}
							</div>
							<p className="text-xs text-muted">{tAuth(`register.${strength.labelKey}`)}</p>
						</div>
					)}
				</div>

				<div className="space-y-2">
					<label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
						{t("settings.confirmPasswordLabel")}
					</label>
					<Input
						id="confirmPassword"
						type="password"
						autoComplete="new-password"
						required
						minLength={8}
						value={confirm}
						onChange={(e) => setConfirm(e.target.value)}
					/>
				</div>

				<div className="flex items-center gap-3">
					<Button
						type="submit"
						className="bg-accent text-white hover:bg-accent-hover"
						disabled={
							loading || !currentPassword || !newPassword || !confirm || strength.score <= 1
						}
					>
						{loading ? t("settings.changePasswordSubmitting") : t("settings.changePasswordSubmit")}
					</Button>
					{!!success && (
						<span className="text-sm text-success">{t("settings.changePasswordSuccess")}</span>
					)}
					{!!error && <span className="text-sm text-destructive">{error}</span>}
				</div>
			</form>
		</div>
	);
}

function DataExportSection() {
	const { t } = useTranslation("profile");
	const [loading, setLoading] = useState(false);

	async function handleExport() {
		setLoading(true);
		try {
			const data = await exportMyData();
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "motori-omat-tiedot.json";
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="mt-8 rounded-xl border border-border bg-card p-5">
			<h2 className="text-lg font-bold text-foreground">{t("settings.exportData")}</h2>
			<p className="mt-1 text-sm text-muted">{t("settings.exportDataDescription")}</p>
			<Button
				type="button"
				variant="outline"
				className="mt-4"
				disabled={loading}
				onClick={handleExport}
			>
				{loading ? t("settings.exportDataLoading") : t("settings.exportDataButton")}
			</Button>
		</div>
	);
}

function DeleteAccountSection() {
	const { t } = useTranslation("profile");
	const [open, setOpen] = useState(false);
	const [confirmation, setConfirmation] = useState("");
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleDelete() {
		setError(null);
		setDeleting(true);
		try {
			await deleteAccount();
			window.location.href = "/";
		} catch {
			setError(t("settings.deleteAccountError"));
			setDeleting(false);
		}
	}

	return (
		<div
			data-testid="delete-account-section"
			className="mt-8 rounded-l border border-destructive/30 bg-card p-5"
		>
			<h2 className="text-lg font-bold text-destructive">{t("settings.deleteAccount")}</h2>
			<p className="mt-1 text-sm text-muted">{t("settings.deleteAccountDescription")}</p>

			{!open ? (
				<Button
					data-testid="delete-account-trigger"
					type="button"
					variant="outline"
					className="mt-4 border-destructive/50 text-destructive hover:bg-destructive/10"
					onClick={() => setOpen(true)}
				>
					{t("settings.deleteAccount")}
				</Button>
			) : (
				<div className="mt-4 space-y-3">
					<label htmlFor="deleteConfirm" className="text-sm font-medium text-foreground">
						{t("settings.deleteAccountConfirm")}
					</label>
					<Input
						data-testid="delete-account-confirm-input"
						id="deleteConfirm"
						value={confirmation}
						onChange={(e) => setConfirmation(e.target.value)}
						placeholder={t("settings.deleteAccountConfirmWord")}
						autoComplete="off"
					/>
					<div className="flex gap-3">
						<Button
							data-testid="delete-account-submit"
							type="button"
							className="bg-destructive text-white hover:bg-destructive/90"
							disabled={confirmation !== t("settings.deleteAccountConfirmWord") || deleting}
							onClick={handleDelete}
						>
							{deleting ? t("settings.deleteAccountDeleting") : t("settings.deleteAccountButton")}
						</Button>
						<Button
							data-testid="delete-account-cancel"
							type="button"
							variant="outline"
							onClick={() => {
								setOpen(false);
								setConfirmation("");
								setError(null);
							}}
						>
							{t("settings.cancel")}
						</Button>
					</div>
					{!!error && (
						<p data-testid="delete-account-error" className="text-sm text-destructive">
							{error}
						</p>
					)}
				</div>
			)}
		</div>
	);
}
