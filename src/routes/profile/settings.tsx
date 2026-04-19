// src/routes/profile/settings.tsx
// Profile settings — edit name, city, phone visibility, license class.
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { LICENSE_CLASSES, type LicenseClass } from "~/lib/constants";
import { db } from "~/lib/db/index";
import { useTranslation } from "~/lib/i18n";
import { getSession } from "~/lib/session";

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
			const licenseClass = LICENSE_CLASS_VALUES.includes(data.licenseClass as LicenseClass)
				? (data.licenseClass as LicenseClass)
				: "";
			return {
				displayName,
				city: data.city.trim(),
				phone: data.phone.trim(),
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

export const Route = createFileRoute("/profile/settings")({
	loader: async () => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/auth/login", search: { redirect: undefined } });
		}
		return loadSettings();
	},
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
					<Link to="/dashboard" className="text-sm text-muted hover:text-foreground">
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
						<span className="text-sm font-medium text-foreground">{t("settings.licenseClassLabel")}</span>
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
						<Button type="button" variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
							{t("settings.cancel")}
						</Button>
						{!!saved && <span className="text-sm text-success">{t("settings.saved")}</span>}
						{!!error && <span className="text-sm text-destructive">{error}</span>}
					</div>
				</form>
			</div>
		</div>
	);
}
