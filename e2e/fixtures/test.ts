import { test as base } from "@playwright/test";

/** A 1×1 PNG, served for the examples' photos and posters (picsum.photos). */
export const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

/**
 * Every spec imports `test` from here.
 * - `offlineImages`: the examples' photos come from picsum.photos and a page's
 *   `load` event waits for its images: when that service hangs, every `goto`
 *   and `reload` times out. The suite answers them with a local pixel; a spec
 *   that needs another answer (a broken image) routes them again, which takes
 *   precedence.
 * - `pageErrors`: a test that fails while its page threw reports those errors
 *   with the failure: a crash then reads as its cause, not as a locator that
 *   timed out waiting for UI that never rendered.
 */
export const test = base.extend<{
  offlineImages: undefined;
  pageErrors: undefined;
}>({
  offlineImages: [
    async ({ context }, use) => {
      await context.route("https://picsum.photos/**", (route) =>
        route.fulfill({ body: PIXEL, contentType: "image/png" })
      );
      await use(undefined);
    },
    { auto: true },
  ],
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
