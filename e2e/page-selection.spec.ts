import { expect } from "@playwright/test";
import { test } from "./fixtures/test";

const NEXT_PAGE = /^(Next|Go to next page)$/;
const SEARCH = /^search/i;

test("Ctrl+A selects the displayed page and preserves search-input editing", async ({
  page,
}) => {
  await page.goto("/?example=views&views-pageSize=2");
  const rows = page
    .locator("[data-yayaw-table-selection-scope] tbody")
    .getByRole("checkbox");
  await expect(rows).toHaveCount(2);
  await page.getByRole("button", { name: NEXT_PAGE }).press("Control+a");
  await expect(rows.nth(0)).toBeChecked();
  await expect(rows.nth(1)).toBeChecked();
  const search = page.getByPlaceholder(SEARCH);
  await search.fill("Alpha");
  await search.press("ControlOrMeta+a");
  await expect(search).toHaveValue("Alpha");
  await expect(search).toHaveJSProperty("selectionStart", 0);
  await expect(search).toHaveJSProperty("selectionEnd", 5);
});
