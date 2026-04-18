import { createStart } from "@tanstack/react-start";
import { loggingMiddleware } from "~/lib/log/middleware";

export const startInstance = createStart(() => ({
	requestMiddleware: [loggingMiddleware],
}));
