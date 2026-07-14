import { type CronTask, runCronTasks } from "@motori/server/cron";
import { createFileRoute } from "@tanstack/react-router";
import { log } from "~/lib/log";

const TASKS: Record<string, CronTask> = {
	"reminder-digest": async () => {
		const { sendReminderDigests } = await import("~/lib/digest");
		const sent = await sendReminderDigests();
		log.info("cron: reminder digests sent", { sent });
		return { sent };
	},
};

export const Route = createFileRoute("/api/cron")({
	server: {
		handlers: {
			POST: ({ request }) => runCronTasks(request, TASKS, log),
		},
	},
});
