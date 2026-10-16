import { defineConfig, devices } from "@playwright/test";

// Overridable so parallel checkouts can run the suite side by side.
const REACT_PORT = Number(process.env.E2E_REACT_PORT ?? 5186);
const VUE_PORT = Number(process.env.E2E_VUE_PORT ?? 5187);
const ci = Boolean(process.env.CI);
// CI serves the prebuilt examples (`bun run e2e:build`): a static server answers
// at once and never recompiles or re-optimizes dependencies mid-run, which a
// dev server under a full parallel suite did and then stopped answering.
const staticBuild = Boolean(process.env.E2E_STATIC);
const SERVER_TIMEOUT = 120_000;
const ACTION_TIMEOUT = 10_000;
const MAX_FAILURES = 15;

const reactServer = staticBuild
  ? `bunx vite preview --config examples/record-presentation-preview/vite.config.mjs --outDir ../../dist/e2e/react --host 127.0.0.1 --port ${REACT_PORT} --strictPort`
  : `bun run records:dev --port ${REACT_PORT} --strictPort`;
const vueServer = staticBuild
  ? `bunx vite preview --config vite.demo.config.ts --base / --outDir ../../dist/e2e/vue --host 127.0.0.1 --port ${VUE_PORT} --strictPort`
  : `bun run dev --host 127.0.0.1 --port ${VUE_PORT} --strictPort`;

/** One suite runs against both editions so their observable behavior stays aligned. */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  // A change that breaks a whole page fails every test of it: stop the shard
  // after enough failures to read the pattern instead of timing out the rest.
  maxFailures: ci ? MAX_FAILURES : 0,
  reporter: ci ? [["github"], ["list"]] : "list",
  use: {
    trace: "retain-on-failure",
    // Fail a click or a fill on missing UI quickly, not at the test timeout.
    actionTimeout: ACTION_TIMEOUT,
    navigationTimeout: ACTION_TIMEOUT,
  },
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
      command: reactServer,
      url: `http://127.0.0.1:${REACT_PORT}`,
      reuseExistingServer: !ci,
      timeout: SERVER_TIMEOUT,
    },
    {
      command: vueServer,
      cwd: "packages/yayaw-table-vue",
      url: `http://127.0.0.1:${VUE_PORT}`,
      reuseExistingServer: !ci,
      timeout: SERVER_TIMEOUT,
    },
  ],
});
