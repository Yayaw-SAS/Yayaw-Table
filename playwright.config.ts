import { defineConfig, devices } from "@playwright/test";

// Overridable so parallel checkouts can run the suite side by side.
const REACT_PORT = Number(process.env.E2E_REACT_PORT ?? 5186);
const VUE_PORT = Number(process.env.E2E_VUE_PORT ?? 5187);
const ci = Boolean(process.env.CI);

/** One suite runs against both editions so their observable behavior stays aligned. */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? "github" : "list",
  use: { trace: "retain-on-failure" },
  projects: [
    {
      name: "react",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${REACT_PORT}`,
      },
    },
    {
      name: "vue",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${VUE_PORT}`,
      },
    },
  ],
  webServer: [
    {
      command: `bun run records:dev --port ${REACT_PORT} --strictPort`,
      url: `http://127.0.0.1:${REACT_PORT}`,
      reuseExistingServer: !ci,
    },
    {
      command: `bun run dev --host 127.0.0.1 --port ${VUE_PORT} --strictPort`,
      cwd: "packages/yayaw-table-vue",
      url: `http://127.0.0.1:${VUE_PORT}`,
      reuseExistingServer: !ci,
    },
  ],
});
