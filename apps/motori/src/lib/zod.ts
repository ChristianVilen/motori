import { z } from "zod";

if (typeof window !== "undefined") {
	// The production CSP blocks Zod's Function constructor probe during schema creation.
	z.config({ jitless: true });
}

export { z };
