// src/routes/taydenna-profiili.tsx

import { Button } from "@motori/ui/button";
import { Input } from "@motori/ui/input";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CitySelect } from "~/components/listings/city-select";
import { AppError } from "~/lib/errors";
import { useTranslation } from "~/lib/i18n";
import { csrfOnly } from "~/lib/middleware";
import { completeProfile } from "~/lib/profile.server";
import { requireSessionOrRedirect, requireUserId } from "~/lib/session";
import { validateFinnishPhone } from "~/lib/validators";

const saveProfile = createServerFn({ method: "POST" })
	.middleware(csrfOnly())
	.inputValidator((data: { displayName: string; city: string; phone: string }) => {
		const displayName = data.displayName.trim();
		if (!displayName) {
			throw new AppError("profile.display_name_required", { field: "displayName" });
		}
		const phone = validateFinnishPhone(data.phone);
		return { displayName, city: data.city.trim(), phone };
	})
	.handler(async ({ data }) => {
		await completeProfile(await requireUserId(), data);
	});

export const Route = createFileRoute("/taydenna-profiili")({
	loader: async ({ location }) => ({ session: await requireSessionOrRedirect(location.pathname) }),
	component: CompleteProfilePage,
});

function CompleteProfilePage() {
	const { session } = Route.useLoaderData();
	const navigate = useNavigate();
	const { t } = useTranslation("auth");
	const [displayName, setDisplayName] = useState(session.user.name ?? "");
	const [city, setCity] = useState("");
	const [phone, setPhone] = useState("");
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
						<CitySelect id="city" value={city} onChange={(newCity, _region) => setCity(newCity)} />
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
