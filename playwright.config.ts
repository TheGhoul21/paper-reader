import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  testMatch: ["reader.spec.ts", "journey.spec.ts", "catalog.spec.ts"],
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4173/paper-reader/", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } },
    },
    {
      name: "narrow-tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    { name: "dark", use: { ...devices["Desktop Chrome"], colorScheme: "dark" } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
    {
      name: "development",
      testMatch: "dev.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5199/" },
    },
  ],
  webServer: [
    {
      command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
      port: 4173,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev -- --host localhost --port 5199 --strictPort",
      url: "http://localhost:5199/",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
