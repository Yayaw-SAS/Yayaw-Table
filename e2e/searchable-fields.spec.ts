import { expect } from "@playwright/test";
import { test } from "./fixtures/test";

/**
 * `searchable` select and multiSelect fields in the records example's form:
 * a button opens a list that filters as you type, picks show on the button
 * (one) or as removable chips (several).
 */
const RECORDS = "/?example=records";

test("a searchable field filters its options as you type", async ({ page }) => {
  await page.goto(RECORDS);
  await page.getByRole("button", { name: "Add item" }).click();
  const dialog = page.getByRole("dialog", { name: "Create" });

  const origin = dialog.getByRole("combobox", { name: "Origin", exact: true });
  await origin.click();
  // The list's search takes the focus: typing searches straight away.
  await expect(
    page.getByRole("combobox", { name: "Origin Search…" })
  ).toBeFocused();
  await page.keyboard.type("swe");
  await expect(page.getByRole("option")).toHaveText(["Sweden"]);
  await page.keyboard.press("Enter");
  await expect(origin).toContainText("Sweden");

  const markets = dialog.getByRole("combobox", {
    name: "Markets",
    exact: true,
  });
  await markets.click();
  await expect(
    page.getByRole("combobox", { name: "Markets Search…" })
  ).toBeFocused();
  await page.keyboard.type("fra");
  await page.keyboard.press("Enter");
  await page.keyboard.type("jap");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(markets).toContainText("2");
  await dialog.getByRole("button", { name: "Remove France" }).click();
  await expect(
    dialog.getByRole("button", { name: "Remove Japan" })
  ).toBeVisible();
  await expect(markets).toContainText("1");
});
