import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e/tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: "html",
	outputDir: "e2e/.test-results",
	globalSetup: "./e2e/global-setup.ts",
	use: {
		baseURL: "http://localhost:3000",
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: "DISABLE_EMAIL_VERIFICATION=true pnpm dev",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
	},
});
