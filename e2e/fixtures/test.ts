import { test as base } from "@playwright/test";

/**
 * Every spec imports `test` from here. A test that fails while its page threw
 * reports those errors with the failure: a crash then reads as its cause, not
 * as a locator that timed out waiting for UI that never rendered.
 */
export const test = base.extend<{ pageErrors: undefined }>({
  pageErrors: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => {
        errors.push(error.stack ?? error.message);
      });
      page.on("console", (message) => {
        if (message.type() === "error") {
          errors.push(`console.error: ${message.text()}`);
        }
      });
      await use(undefined);
      if (errors.length > 0 && testInfo.status !== testInfo.expectedStatus) {
        throw new Error(
          `The page reported ${errors.length} error(s):\n\n${errors.slice(0, 5).join("\n\n")}`
        );
      }
    },
    { auto: true },
  ],
});
