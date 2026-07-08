import { createLog } from "@motori/server/log";
import type { EventName } from "./events";

export const log = createLog<EventName>();
export { withLogContext } from "@motori/server/log";
