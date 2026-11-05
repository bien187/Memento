import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testMatch: "community.spec.ts",
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3101",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { channel: "chrome" },
  },
  projects: [
    {
      name: "community-375",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: "community-430",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        viewport: { width: 430, height: 932 },
      },
    },
  ],
  webServer: {
    command: "node --import tsx scripts/community-e2e-server.ts",
    url: "http://localhost:3101",
    timeout: 120000,
    reuseExistingServer: false,
  },
});
