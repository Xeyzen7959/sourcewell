import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:8001", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: `${process.env.SOURCEWELL_PYTHON ?? ".venv/bin/python"} -m uvicorn backend.main:create_app --factory --host 127.0.0.1 --port 8001`,
    cwd: "..",
    url: "http://127.0.0.1:8001/api/health",
    reuseExistingServer: false,
    env: {
      DATA_DIR: join(tmpdir(), `sourcewell-e2e-${Date.now()}`),
      OPENAI_API_KEY: "",
      ADMIN_TOKEN: "e2e-test-only",
      APP_MODE: "local",
      REQUESTS_PER_MINUTE: "1000",
    },
  },
});
