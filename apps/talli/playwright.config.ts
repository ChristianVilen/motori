import { defineConfig, devices } from "@playwright/test";

import { MOTORI_URL, motoriPort, TALLI_URL, talliPort } from "./e2e/base-url";

const motoriEnv = "DISABLE_EMAIL_VERIFICATION=true DISABLE_AUTH_RATE_LIMIT=true";

export default defineConfig({
	testDir: "./e2e/tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	maxFailures: 1,
	reporter: [["html", { open: "never" }]],
	outputDir: "e2e/.test-results",
	globalSetup: "./e2e/global-setup.ts",
	globalTeardown: "./e2e/global-teardown.ts",
	use: {
		baseURL: TALLI_URL,
		trace: "on-first-retry",
		locale: "fi-FI",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: [
		{
			command: process.env.CI
				? `${motoriEnv} pnpm --filter motori start`
				: `${motoriEnv} pnpm --filter motori build && ${motoriEnv} pnpm --filter motori start`,
			url: `${MOTORI_URL}/api/health`,
			env: { PORT: motoriPort, BETTER_AUTH_URL: MOTORI_URL, APP_ORIGIN: MOTORI_URL },
			reuseExistingServer: !process.env.CI,
			timeout: 180_000,
		},
		{
			command: process.env.CI ? "pnpm start" : "pnpm build && pnpm start",
			url: `${TALLI_URL}/api/health`,
			env: { PORT: talliPort, BETTER_AUTH_URL: MOTORI_URL, APP_ORIGIN: TALLI_URL },
			reuseExistingServer: !process.env.CI,
			timeout: 180_000,
		},
	],
});
