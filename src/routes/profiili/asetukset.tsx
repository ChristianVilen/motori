// src/routes/profiili/asetukset.tsx
// Profile settings — edit name, city, phone visibility, license class.
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { authClient } from "~/lib/auth-client";
import { LICENSE_CLASSES, type LicenseClass, SITE_NAME } from "~/lib/constants";
import { csrfMiddleware } from "~/lib/csrf";
import { db } from "~/lib/db/index";
import { deleteAccount } from "~/lib/delete-account";
import { useTranslation } from "~/lib/i18n";
import { passwordStrength } from "~/lib/password-strength";
import { getSession } from "~/lib/session";
import { validateFinnishPhone } from "~/lib/validators";

const LICENSE_CLASS_VALUES = LICENSE_CLASSES.map((c) => c.value) as LicenseClass[];

const loadSettings = createServerFn({ method: "GET" }).handler(async () => {
	const session = await getSession();
	if (!session) {
		throw new Error("Ei istuntoa");
	}
	const profile = await db
		.selectFrom("profile")
		.selectAll()
		.where("user_id", "=", session.user.id)
		.executeTakeFirst();
	return { profile: profile ?? null, session };
});

const saveSettings = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware()])
	.inputValidator(
		(data: {
			displayName: string;
			city: string;
			phone: string;
			showPhone: boolean;
			licenseClass: string;
		}) => {
			const displayName = data.displayName.trim();
			if (!displayName) {
				throw new Error("Näyttönimi on pakollinen");
			}
			const phone = validateFinnishPhone(data.phone);
			const licenseClass = LICENSE_CLASS_VALUES.includes(data.licenseClass as LicenseClass)
				? (data.licenseClass as LicenseClass)
				: "";
			return {
				displayName,
				city: data.city.trim(),
				phone,
				showPhone: data.showPhone,
				licenseClass,
			};
		},
	)
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Ei istuntoa");
		}
		const licenseClass = data.licenseClass as LicenseClass | "";
		await db
			.insertInto("profile")
			.values({
				user_id: session.user.id,
				display_name: data.displayName,
				city: data.city || null,
				phone: data.phone || null,
				show_phone: data.showPhone,
				license_class: licenseClass || null,
				language: "fi",
			})
			.onConflict((oc) =>
				oc.column("user_id").doUpdateSet({
					display_name: data.displayName,
					city: data.city || null,
					phone: data.phone || null,
					show_phone: data.showPhone,
					license_class: licenseClass || null,
					updated_at: new Date(),
				}),
			)
			.execute();
	});

export const Route = createFileRoute("/profiili/asetukset")({
	loader: async () => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/kirjaudu", search: { redirect: undefined } });
		}
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
	const [licenseClass, setLicenseClass] = useState<string>(profile?.license_class ?? "");
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
				data: { displayName, city, phone, showPhone, licenseClass },
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
					className="space-y-5 rounded-xl border border-border bg-card p-5"
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
						<Input
							id="city"
							value={city}
							onChange={(e) => setCity(e.target.value)}
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

					<div className="space-y-2">
						<span className="text-sm font-medium text-foreground">
							{t("settings.licenseClassLabel")}
						</span>
						<div className="flex gap-2">
							{LICENSE_CLASSES.map((cls) => (
								<button
									key={cls.value}
									type="button"
									onClick={() => setLicenseClass(licenseClass === cls.value ? "" : cls.value)}
									className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
										licenseClass === cls.value
											? "border-accent bg-accent text-white"
											: "border-border bg-background text-foreground hover:bg-muted-light"
									}`}
								>
									{cls.label}
								</button>
							))}
						</div>
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
		<div className="mt-6 rounded-xl border border-border bg-card p-5">
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
			className="mt-8 rounded-xl border border-destructive/30 bg-card p-5"
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
						placeholder="POISTA"
						autoComplete="off"
					/>
					<div className="flex gap-3">
						<Button
							data-testid="delete-account-submit"
							type="button"
							className="bg-destructive text-white hover:bg-destructive/90"
							disabled={confirmation !== "POISTA" || deleting}
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
