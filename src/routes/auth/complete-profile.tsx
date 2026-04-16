// src/routes/auth/complete-profile.tsx
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { db } from "~/lib/db/index";
import { getSession } from "~/lib/session";

const saveProfile = createServerFn({ method: "POST" })
	.inputValidator(
		(data: {
			displayName: string;
			city: string;
			phone: string;
			licenseClass: string;
			userId: string;
		}) => data,
	)
	.handler(async ({ data }) => {
		await db
			.insertInto("profile")
			.values({
				user_id: data.userId,
				display_name: data.displayName,
				city: data.city || null,
				phone: data.phone || null,
				license_class: (data.licenseClass as "A1" | "A2" | "A") || null,
				language: "fi",
			})
			.onConflict((oc) =>
				oc.column("user_id").doUpdateSet({
					display_name: data.displayName,
					city: data.city || null,
					phone: data.phone || null,
					license_class: (data.licenseClass as "A1" | "A2" | "A") || null,
					updated_at: new Date(),
				}),
			)
			.execute();
	});

export const Route = createFileRoute("/auth/complete-profile")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session) throw redirect({ to: "/auth/login" });
		return { session };
	},
	component: CompleteProfilePage,
});

const LICENSE_CLASSES = ["A1", "A2", "A"] as const;

function CompleteProfilePage() {
	const { session } = Route.useRouteContext();
	const navigate = useNavigate();
	const [displayName, setDisplayName] = useState(session.user.name ?? "");
	const [city, setCity] = useState("");
	const [phone, setPhone] = useState("");
	const [licenseClass, setLicenseClass] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);

		await saveProfile({
			data: {
				userId: session.user.id,
				displayName,
				city,
				phone,
				licenseClass,
			},
		});

		setLoading(false);
		navigate({ to: "/" });
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-primary">Viimeistele profiilisi</h1>
					<p className="mt-1 text-sm text-muted">Kertoo muille käyttäjille kuka olet</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<label htmlFor="displayName" className="text-sm font-medium text-foreground">
							Näyttönimi <span className="text-destructive">*</span>
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
							Kaupunki
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
							Puhelinnumero
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
						<span className="text-sm font-medium text-foreground">Ajokorttilaji</span>
						<div className="flex gap-2">
							{LICENSE_CLASSES.map((cls) => (
								<button
									key={cls}
									type="button"
									onClick={() => setLicenseClass(licenseClass === cls ? "" : cls)}
									className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
										licenseClass === cls
											? "border-accent bg-accent text-white"
											: "border-border bg-background text-foreground hover:bg-muted-light"
									}`}
								>
									{cls}
								</button>
							))}
						</div>
					</div>

					<Button
						type="submit"
						className="w-full bg-accent text-white hover:bg-accent-hover"
						disabled={loading || !displayName.trim()}
					>
						{loading ? "Tallennetaan..." : "Valmis"}
					</Button>
				</form>
			</div>
		</div>
	);
}
