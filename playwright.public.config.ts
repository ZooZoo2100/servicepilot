import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/public-browser",
  outputDir: "test-results/public",
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:3400",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node dist/server.js",
    url: "http://localhost:3400",
    reuseExistingServer: false,
    env: {
      NODE_ENV: "production",
      PUBLIC_DEMO: "true",
      PORT: "3400",
      APP_ORIGIN: "http://localhost:3400",
      DEMO_SESSION_SECRET:
        "public-browser-fixture-secret-not-a-real-credential",
      AGENT_PROVIDER: "openai",
      CONVERSATION_RATE_LIMIT: "200",
    },
  },
  reporter: [["list"]],
});
