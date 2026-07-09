import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { formErrorMessage } from "~/lib/errors";
import { getSettings, updateSettings } from "~/lib/settings";

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

	async function toggle(checked: boolean) {
		try {
			await updateSettings({ data: { email_reminders: checked } });
		} catch (err) {
			toast.error(formErrorMessage(err));
		} finally {
			router.invalidate();
		}
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
					onChange={(e) => toggle(e.target.checked)}
				/>
			</label>
		</div>
	);
}
