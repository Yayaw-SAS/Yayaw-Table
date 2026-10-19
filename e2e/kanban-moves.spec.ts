import { expect, test } from "@playwright/test";

const MOVE_BUTTON = /^Move /;

test("moves a remote card by dragging, then recovers a failed keyboard move", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?example=server-kanban");
  const lane = (value: string) => page.locator(`[data-kanban-lane="${value}"]`);
  const card = () => page.locator('[data-row-id="1"]');
  await expect(lane("working").locator('[data-row-id="1"]')).toBeVisible();
  await expect(card()).toHaveAttribute("draggable", "true");
  await expect(page.locator('[data-row-id="2"]')).toHaveAttribute(
    "draggable",
    "false"
  );
  await expect(
    page.locator('[data-row-id="2"]').getByRole("button", { name: MOVE_BUTTON })
  ).toHaveCount(0);
  await card().getByRole("link").dragTo(lane("done"));
  await expect(lane("working").locator('[data-row-id="1"]')).toBeVisible();
  await expect(lane("done").locator('[data-row-id="1"]')).toHaveCount(0);
  await card().dragTo(lane("done"));
  await expect(lane("done").locator('[data-row-id="1"]')).toBeVisible();
  await expect(lane("working").locator('[data-row-id="1"]')).toHaveCount(0);
  // The adjacent buttons are available to keyboard and assistive technology users.
  const move = () =>
    card().getByRole("button", { name: "Move Record 1 to Waiting" });
  await move().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(lane("done").locator('[data-row-id="1"]')).toBeVisible();
  await move().click();
  await expect(lane("empty").locator('[data-row-id="1"]')).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});
