import { expect, type Locator } from "@playwright/test";
import { test } from "./fixtures/test";

const ICON = "[data-yayaw-option-icon]";
const SVG_MASK = /url\("data:image\/svg\+xml/;

async function iconColor(option: Locator) {
  const icon = option.locator(ICON);
  await expect(icon).toBeVisible();
  await expect(icon).toHaveAttribute("aria-hidden", "true");
  await expect(icon).toHaveCSS("width", "16px");
  await expect(icon).toHaveCSS("mask-image", SVG_MASK);
  const styles = await icon.evaluate((element) => {
    const { backgroundColor, color } = getComputedStyle(element);
    return { backgroundColor, color };
  });
  expect(styles.backgroundColor).toBe(styles.color);
  return styles.color;
}

test("inline editors and quick filters show the option icon in both themes", async ({
  page,
}) => {
  const filters: string[] = [];
  const inlineEditors: string[] = [];
  for (const theme of ["light", "dark"]) {
    await page.goto(`/?example=records&theme=${theme}`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("button", { name: "Category", exact: true }).click();
    const filterChoice = page.getByRole("checkbox", { name: "Software" });
    filters.push(await iconColor(filterChoice.locator("..")));
    await expect(
      page
        .getByRole("checkbox", { name: "Hardware" })
        .locator("..")
        .locator(ICON)
    ).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page
      .locator('[data-display-mode-switch] [data-layout="table"]')
      .click();
    await page
      .getByRole("cell", { name: "Software", exact: true })
      .locator('[data-inline-editor="select"]')
      .click();
    inlineEditors.push(
      await iconColor(
        page.getByRole("option", { name: "Software", exact: true })
      )
    );
  }

  expect(filters[0]).not.toBe(filters[1]);
  expect(inlineEditors[0]).not.toBe(inlineEditors[1]);
});
