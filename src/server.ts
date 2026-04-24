// srvx FastResponse: ~5% throughput improvement on Node.js by optimizing
// Web Response → Node.js conversion. Only applies to Nitro/h3/srvx deployments.
// Must run before any other imports that use Response.
import { FastResponse } from "srvx";

globalThis.Response = FastResponse;

import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createServerEntry({
	fetch(request) {
		return handler.fetch(request);
	},
});
