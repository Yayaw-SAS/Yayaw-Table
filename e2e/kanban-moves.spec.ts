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
  await expect(
    page.locator("[data-kanban-drag-handle], .yayaw-kanban-drag-handle")
  ).toHaveCount(0);
  await expect(page.locator('[data-row-id="2"]')).toHaveAttribute(
    "draggable",
    "false"
  );
  await expect(page.getByRole("button", { name: MOVE_BUTTON })).toHaveCount(0);
  await card().getByRole("link").dragTo(lane("done"));
  await expect(lane("working").locator('[data-row-id="1"]')).toBeVisible();
  await expect(lane("done").locator('[data-row-id="1"]')).toHaveCount(0);
  await card().dragTo(lane("done"));
  await expect(lane("done").locator('[data-row-id="1"]')).toBeVisible();
  await expect(lane("working").locator('[data-row-id="1"]')).toHaveCount(0);
  // Keyboard users move the focused card without extra visible controls.
  await card().focus();
  await page.keyboard.press("Alt+Shift+ArrowRight");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(lane("done").locator('[data-row-id="1"]')).toBeVisible();
  await card().focus();
  await page.keyboard.press("Alt+Shift+ArrowRight");
  await expect(lane("empty").locator('[data-row-id="1"]')).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});
