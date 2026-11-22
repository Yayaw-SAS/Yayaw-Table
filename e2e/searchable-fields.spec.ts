import { expect } from "@playwright/test";
import { test } from "./fixtures/test";

/**
 * `searchable` select and multiSelect fields in the records example's form:
 * a button opens a list that filters as you type, picks show on the button
 * (one) or as removable chips (several).
 */
const RECORDS = "/?example=records";
const CREATE_CAMPAIGN = /Create.*Campaign/;

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

test("a select of more than 200 options is searched and draws its first matches", async ({
  page,
}) => {
  await page.goto(RECORDS);
  await page.getByRole("button", { name: "Add item" }).click();
  const dialog = page.getByRole("dialog", { name: "Create" });

  // 500 suppliers, no `searchable` flag: a searchable list all the same.
  const supplier = dialog.getByRole("combobox", {
    name: "Supplier",
    exact: true,
  });
  await supplier.click();
  await expect(page.getByRole("option")).toHaveCount(100);
  await expect(
    page.getByText("400 more: type to narrow the list")
  ).toBeVisible();
  await page.keyboard.type("450");
  await expect(page.getByRole("option")).toHaveText(["Supplier 450"]);
  await page.keyboard.press("Enter");
  await expect(supplier).toContainText("Supplier 450");
});

test("remote Tag and Media lists save choices and resolve their labels on reopen", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  await page.goto(RECORDS);
  await page.getByRole("button", { name: "Add item" }).click();
  const dialog = page.getByRole("dialog", { name: "Create" });
  await dialog.getByRole("textbox", { name: "Name" }).fill("Remote record");

  await dialog.getByRole("combobox", { name: "Tag", exact: true }).click();
  const tagSearch = page.getByRole("combobox", { name: "Tag Search…" });
  await expect(tagSearch).toBeFocused();
  await tagSearch.fill("lau");
  await page.getByRole("option", { name: "Launch", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Remove Launch" })
  ).toBeVisible();
  await tagSearch.fill("Campaign");
  await page.getByRole("option", { name: CREATE_CAMPAIGN }).click();
  await expect(
    dialog.getByRole("button", { name: "Remove Campaign" })
  ).toBeVisible();
  await page.keyboard.press("Escape");

  const media = dialog.getByRole("combobox", { name: "Media", exact: true });
  await media.click();
  const mediaSearch = page.getByRole("combobox", { name: "Media Search…" });
  await mediaSearch.fill("error");
  await expect(
    page.getByText("The catalogue is unavailable. Try another search.")
  ).toBeVisible();
  // The server's alias matches a result whose label does not include the query.
  await mediaSearch.fill("hero");
  await page.getByRole("option", { name: "Launch image", exact: true }).click();
  await expect(media).toContainText("Launch image");

  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByText("Remote record", { exact: true }).first().click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Remote record", exact: true });
  await expect(
    edit.getByRole("button", { name: "Remove Launch", exact: true })
  ).toBeVisible();
  await expect(
    edit.getByRole("button", { name: "Remove Campaign" })
  ).toBeVisible();
  await expect(
    edit.getByRole("combobox", { name: "Media", exact: true })
  ).toContainText("Launch image");
  expect(errors).toEqual([]);
});
