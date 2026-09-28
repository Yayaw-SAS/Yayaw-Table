import { expect, test } from "@playwright/test";

const ECHO = /Echo sensors/;
const INVALID_COORDINATES =
  "Enter a latitude between -90 and 90 and a longitude between -180 and 180.";
const SUCCESS = "Thank you, your response has been recorded.";

/** Both editions must save the visible draft, never its last valid place. */
test("invalid inline coordinates block Done and blur until corrected", async ({
  page,
}) => {
  await page.goto("/?example=views");
  const row = page.getByRole("row", { name: ECHO });
  await row
    .getByRole("cell")
    .filter({ hasText: "—" })
    .last()
    .locator("button, [tabindex='0']")
    .first()
    .focus();
  await page.keyboard.press("Enter");
  const editor = page.getByRole("group", { name: "Site" });
  await editor
    .getByRole("textbox", { name: "Search an address" })
    .fill("48.8566, 2.3522");
  const latitude = editor.getByRole("textbox", { name: "Latitude" });
  await expect(latitude).toHaveValue("48.8566");
  await latitude.fill("91");
  await editor.getByRole("button", { name: "Done", exact: true }).click();
  await expect(editor).toBeVisible();
  await expect(editor.getByRole("alert")).toHaveText(INVALID_COORDINATES);
  await page.getByRole("heading", { name: "Views", exact: true }).click();
  await expect(editor).toBeVisible();
  await expect(latitude).toHaveValue("91");
  await latitude.fill("49");
  await editor.getByRole("button", { name: "Done", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(row.locator("[data-location-cell]")).toContainText("49, 2.3522");
});

test("a form rejects a partial optional location and accepts an explicit clear", async ({
  page,
}) => {
  await page.goto("/?example=views&views-display=form");
  const form = page.locator("[data-yayaw-form]");
  await form
    .getByRole("textbox", { name: "Name", exact: true })
    .first()
    .fill("Location validation request");
  const location = form.getByRole("group", { name: "Site" });
  await location.getByRole("textbox", { name: "Latitude" }).fill("48.8566");
  await form.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(location.getByRole("alert")).toHaveText(INVALID_COORDINATES);
  await expect(page.getByText(SUCCESS, { exact: true })).toBeHidden();
  await location.getByRole("button", { name: "Clear", exact: true }).click();
  await form.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText(SUCCESS, { exact: true })).toBeVisible();
});

test("typing a coordinate pair character by character preserves its full precision", async ({
  page,
}) => {
  await page.goto("/?example=views");
  const row = page.getByRole("row", { name: ECHO });
  await row
    .getByRole("cell")
    .filter({ hasText: "—" })
    .last()
    .locator("button, [tabindex='0']")
    .first()
    .focus();
  await page.keyboard.press("Enter");
  const editor = page.getByRole("group", { name: "Site" });
  const address = editor.getByRole("textbox", { name: "Search an address" });
  await address.pressSequentially("48.8566, 2.3522");
  await expect(address).toHaveValue("48.8566, 2.3522");
  await expect(editor.getByRole("textbox", { name: "Latitude" })).toHaveValue(
    "48.8566"
  );
  await expect(editor.getByRole("textbox", { name: "Longitude" })).toHaveValue(
    "2.3522"
  );
  await editor.getByRole("button", { name: "Done", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(row.locator("[data-location-cell]")).toContainText(
    "48.8566, 2.3522"
  );
});
