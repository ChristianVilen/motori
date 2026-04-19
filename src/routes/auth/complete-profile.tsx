// src/routes/auth/complete-profile.tsx
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { LICENSE_CLASSES, type LicenseClass } from "~/lib/constants";
import { db } from "~/lib/db/index";
import { useTranslation } from "~/lib/i18n";
import { getSession } from "~/lib/session";

const LICENSE_CLASS_VALUES = LICENSE_CLASSES.map((c) => c.value) as LicenseClass[];

const saveProfile = createServerFn({ method: "POST" })
	.inputValidator(
		(data: { displayName: string; city: string; phone: string; licenseClass: string }) => {
			const displayName = data.displayName.trim();
			if (!displayName) {
				throw new Error("Näyttönimi on pakollinen");
			}
			const licenseClass = LICENSE_CLASS_VALUES.includes(data.licenseClass as LicenseClass)
				? (data.licenseClass as LicenseClass)
				: "";
			return { displayName, city: data.city, phone: data.phone, licenseClass };
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
				license_class: licenseClass || null,
				language: "fi",
			})
			.onConflict((oc) =>
				oc.column("user_id").doUpdateSet({
					display_name: data.displayName,
					city: data.city || null,
					phone: data.phone || null,
					license_class: licenseClass || null,
					updated_at: new Date(),
				}),
			)
			.execute();
	});

export const Route = createFileRoute("/auth/complete-profile")({
	loader: async () => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/auth/login", search: { redirect: undefined } });
		}
		return { session };
	},
	component: CompleteProfilePage,
});

function CompleteProfilePage() {
	const { session } = Route.useLoaderData();
	const navigate = useNavigate();
	const { t } = useTranslation("auth");
	const [displayName, setDisplayName] = useState(session.user.name ?? "");
	const [city, setCity] = useState("");
	const [phone, setPhone] = useState("");
	const [licenseClass, setLicenseClass] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			await saveProfile({
				data: {
					displayName,
					city,
					phone,
					licenseClass,
				},
			});
			navigate({ to: "/" });
		} catch {
			setError(t("completeProfile.errorGeneric"));
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-primary">{t("completeProfile.heading")}</h1>
					<p className="mt-1 text-sm text-muted">{t("completeProfile.tagline")}</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<label htmlFor="displayName" className="text-sm font-medium text-foreground">
							{t("completeProfile.displayNameLabel")} <span className="text-destructive">*</span>
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
							{t("completeProfile.cityLabel")}
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
							{t("completeProfile.phoneLabel")}
						</label>
						<Input
							id="phone"
							type="tel"
							value={phone}
							onChange={(e) => setPhone(e.target.value)}
							placeholder="+358 40 123 4567"
						/>
					</div>

					<div className="space-y-2">
						<span className="text-sm font-medium text-foreground">
							{t("completeProfile.licenseClassLabel")}
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

					<Button
						type="submit"
						className="w-full bg-accent text-white hover:bg-accent-hover"
						disabled={loading || !displayName.trim()}
					>
						{loading ? t("completeProfile.submitLoading") : t("completeProfile.submitIdle")}
					</Button>

					{!!error && <p className="text-sm text-destructive">{error}</p>}
				</form>
			</div>
		</div>
	);
}
