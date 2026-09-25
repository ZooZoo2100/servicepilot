import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results/local",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node --import tsx src/server/index.ts",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    env: {
      PORT: "3100",
      APP_ORIGIN: "http://localhost:3100",
      DATABASE_PATH: ":memory:",
      DEMO_MODE: "true",
      AGENT_PROVIDER: "simulation",
      ADMIN_TOKEN: "e2e-only-token",
      CONVERSATION_RATE_LIMIT: "200",
    },
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
