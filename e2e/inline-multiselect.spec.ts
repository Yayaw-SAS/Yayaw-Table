import { expect } from "@playwright/test";
import { test } from "./fixtures/test";

test("Enter saves the highlighted option in an inline multi-select", async ({
  page,
}) => {
  await page.goto("/?example=products&products-display=table");
  const row = page.getByRole("row").filter({ hasText: "Workspace Pro" });
  const cellEditor = row.locator('[data-inline-editor="multiSelect"]');
  await cellEditor.click();

  const input = row.getByRole("combobox", { name: "Tags", exact: true });
  await input.fill("sale");
  const option = page.locator('[role="option"]').filter({ hasText: "On sale" });
  await expect(option).toBeVisible();
  await input.press("ArrowDown");
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    (await option.getAttribute("id")) ?? ""
  );
  await input.press("Enter");

  await expect(input).toHaveCount(0);
  await expect(cellEditor).toContainText("On sale");
});
