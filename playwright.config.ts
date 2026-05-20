import { defineConfig, devices } from "@playwright/test";

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
		baseURL: "http://localhost:3000",
		trace: "on-first-retry",
		locale: "fi-FI",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
			testIgnore: ["**/mobile-bottom-nav.spec.ts", "**/mobile-chat-back.spec.ts"],
		},
		{
			name: "mobile",
			use: { ...devices["iPhone 15"] },
			testMatch: ["**/a11y.spec.ts", "**/listings.spec.ts", "**/mobile-*.spec.ts"],
		},
	],
	webServer: {
		command: process.env.CI
			? "DISABLE_EMAIL_VERIFICATION=true pnpm start"
			: "DISABLE_EMAIL_VERIFICATION=true pnpm build && DISABLE_EMAIL_VERIFICATION=true pnpm start",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
	},
});
