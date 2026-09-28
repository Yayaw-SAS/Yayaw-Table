import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
import base from "../../playwright.config";

const projectRoot = resolve(__dirname, "../..");
const configuredServers = base.webServer ?? [];
const servers = Array.isArray(configuredServers)
  ? configuredServers
  : [configuredServers];

/** Explicit visual review only; reuse the same isolated React and Vue demos. */
export default defineConfig({
  ...base,
  testDir: ".",
  outputDir:
    process.env.DASHBOARD_VISUAL_RESULTS_DIR ??
    "/tmp/yayaw-dashboard-visual-results",
  webServer: servers.map((server) => ({
    ...server,
    cwd: resolve(projectRoot, server.cwd ?? "."),
  })),
});
