import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { getSettings, updateSettings } from "~/lib/settings";
import { useSubmit } from "~/lib/use-submit";

export const Route = createFileRoute("/asetukset")({
	loader: async ({ context }) => {
		if (!context.session) {
			throw redirect({ to: "/" });
		}
		return getSettings();
	},
	component: SettingsPage,
});

function SettingsPage() {
	const settings = Route.useLoaderData();
	const router = useRouter();
	const { saving, submit } = useSubmit();

	async function toggle(checked: boolean) {
		await submit(async () => {
			await updateSettings({ data: { email_reminders: checked } });
			router.invalidate();
		});
	}

	return (
		<div className="mx-auto max-w-lg">
			<h1 className="font-heading text-2xl font-bold">Asetukset</h1>
			<label className="mt-6 flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
				<span>
					<span className="font-medium">Muistutukset sähköpostiin</span>
					<span className="mt-0.5 block text-xs text-muted">
						Päivittäinen kooste, kun huolto erääntyy tai on erääntymässä.
					</span>
				</span>
				<input
					type="checkbox"
					data-testid="settings-email-reminders"
					checked={settings.email_reminders}
					disabled={saving}
					onChange={(e) => toggle(e.target.checked)}
				/>
			</label>
		</div>
	);
}
