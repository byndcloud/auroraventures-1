import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Load e2e credentials from .env.test (not committed to git)
loadEnv({ path: ".env.test", override: false });

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
