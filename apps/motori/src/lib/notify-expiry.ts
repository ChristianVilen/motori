import { db } from "~/lib/db/index";
import { log, withLogContext } from "~/lib/log";
import { sendListingExpiryWarnings } from "~/lib/notifications";

await withLogContext({ script: "notify-expiry" }, async () => {
	const sent = await sendListingExpiryWarnings();
	log.info("expiry warnings complete", { sent });
	await db.destroy();
});
