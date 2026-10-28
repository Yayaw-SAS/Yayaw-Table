import { expect } from "@playwright/test";
import { test } from "./fixtures/test";

const image =
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#477ddb"/><circle cx="320" cy="240" r="120" fill="#facc15"/></svg>';

for (const theme of ["light", "dark"]) {
  test(`${theme}: image cells preview on hover and keyboard focus without opening the record`, async ({
    page,
  }, testInfo) => {
    await page.route("https://picsum.photos/**", (route) =>
      route.fulfill({ contentType: "image/svg+xml", body: image })
    );
    await page.goto(`/?example=products&theme=${theme}`);
    const thumbnail = page.locator("[data-image-preview-trigger]").first();
    const preview = page.locator("[data-image-preview]");
    await expect(thumbnail).toBeVisible();
    await thumbnail.hover();
    await expect(preview).toBeVisible();
    await expect(preview.locator("img")).toHaveAttribute(
      "src",
      (await thumbnail.locator("img").getAttribute("src")) ?? ""
    );
    const thumbBox = await thumbnail.boundingBox();
    const previewBox = await preview.locator("img").boundingBox();
    if (!(previewBox && thumbBox)) {
      throw new Error("The image preview must have a visible bounding box");
    }
    expect(previewBox.width).toBeGreaterThan(thumbBox.width);
    await page.screenshot({ path: testInfo.outputPath("image-preview.png") });
    await page.keyboard.press("Escape");
    await expect(preview).toBeHidden();
    await page.mouse.move(0, 0);
    // Leave and re-enter with the keyboard: Escape blocks reopening until
    // focus leaves the trigger, and programmatic focus is not a Tab entry.
    await thumbnail.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(thumbnail).toBeFocused();
    await page.mouse.move(1, 1);
    await expect(preview).toBeVisible();
    await thumbnail.press("Tab");
    await expect(preview).toBeHidden();
    await page.keyboard.press("Shift+Tab");
    await expect(thumbnail).toBeFocused();
    await expect(preview).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(preview).toBeHidden();
    for (const key of ["Enter", "Space"]) {
      await thumbnail.press(key);
      await expect(preview).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(preview).toBeHidden();
    }
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await thumbnail.click();
    await expect(preview).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

test("broken image cells keep their fallback without a preview trigger", async ({
  page,
}) => {
  await page.route("https://picsum.photos/**", (route) =>
    route.fulfill({ contentType: "image/png", body: "not an image" })
  );
  await page.goto("/?example=products");
  await expect(
    page.getByRole("row").filter({ hasText: "Workspace Pro" })
  ).toBeVisible();
  await expect(page.locator("[data-image-preview-trigger]")).toHaveCount(0);
  await expect(page.locator("[data-image-preview]")).toHaveCount(0);
});
