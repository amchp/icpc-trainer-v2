import { defineConfig, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { getLiveEnv } from "./tests/e2e/live/helpers/env";

const liveEnv = getLiveEnv();
const artifactsDir = path.dirname(liveEnv.storageStatePath);
const liveDatabasePath = path.resolve(process.cwd(), "tests/e2e/.artifacts/live.db");
const startupCommand =
  `bash -lc 'mkdir -p tests/e2e/.artifacts && ` +
  `rm -f tests/e2e/.artifacts/live.db && ` +
  `trap "kill 0" EXIT && ` +
  `(cd apps/server && PORT=4000 DATABASE_URL=${liveDatabasePath} bun run src/main.ts) & ` +
  `exec sh -lc "cd apps/web && VITE_API_BASE_URL=${liveEnv.apiBaseUrl} bun run dev -- --host 127.0.0.1 --port 3000"'`;

mkdirSync(artifactsDir, { recursive: true });

export default defineConfig({
  testDir: "./tests/e2e/live",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  workers: 1,
  expect: {
    timeout: 20_000,
  },
  reporter: "list",
  use: {
    baseURL: liveEnv.baseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 30_000,
    headless: liveEnv.headless,
    launchOptions: {
      slowMo: liveEnv.slowMo,
    },
  },
  webServer: {
    command: startupCommand,
    url: liveEnv.baseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.spec\.ts/,
    },
    {
      name: "chromium",
      testIgnore: /auth\.setup\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: liveEnv.storageStatePath,
      },
    },
  ],
});
