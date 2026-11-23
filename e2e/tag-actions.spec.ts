import { expect, type Locator, type Page } from "@playwright/test";
import { test } from "./fixtures/test";

const SOFTWARE_TAG = /^Software$/;
const ACTIVE_TAG = /^Active$/;
const softwareTag = (page: Page | Locator) =>
  page.locator("[data-tag-button]").filter({ hasText: SOFTWARE_TAG }).first();
const activeTag = (page: Page) =>
  page.locator("[data-tag-button]").filter({ hasText: ACTIVE_TAG }).first();

const copied = (page: Page) =>
  page.evaluate(() => navigator.clipboard.readText());

test.beforeEach(async ({ page }) => {
  // Keep each host callback's result local to its page, even with parallel tests.
  await page.addInitScript(() => {
    let text = "";
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: (value: string) => {
          text = value;
          return Promise.resolve();
        },
        readText: () => Promise.resolve(text),
      },
    });
  });
});

for (const display of ["table", "list", "gallery", "kanban"]) {
  test(`${display}: a tag menu opens on click and right-click and receives the value and row`, async ({
    page,
  }) => {
    await page.goto(`/?example=products&products-display=${display}`);
    const tag = softwareTag(page);
    await expect(tag).toHaveAttribute("aria-haspopup", "menu");
    await tag.click();
    await expect(tag).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("menuitem", { name: "Copy tag", exact: true }).click();
    await expect.poll(() => copied(page)).toBe("Workspace Pro: software");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await tag.click({ button: "right" });
    await expect(
      page.getByRole("menuitem", { name: "Copy tag" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tag).toBeFocused();
    await expect(tag).toHaveAttribute("aria-expanded", "false");
  });
}

test("keyboard activation and the primary tag callback keep their own behavior", async ({
  page,
}) => {
  await page.goto("/?example=products&products-display=table");
  const tag = softwareTag(page);
  for (const key of ["Enter", "Space", "ContextMenu", "Shift+F10"]) {
    await tag.focus();
    await tag.press(key);
    await expect(
      page.getByRole("menuitem", { name: "Copy tag" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tag).toBeFocused();
  }

  const primary = activeTag(page);
  await primary.click();
  await expect.poll(() => copied(page)).toBe("Workspace Pro: active");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await primary.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "Copy tag" })).toBeVisible();
  await page.keyboard.press("Escape");
  await primary.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Copy tag" })).toBeVisible();
});

test("touch long press opens the menu, while scrolling cancels it", async ({
  page,
}) => {
  await page.goto("/?example=products&products-display=table");
  const tag = softwareTag(page);
  // Synthetic touch pointers exercise the same handlers in both desktop projects.
  await tag.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "touch",
    clientX: 20,
    clientY: 20,
    button: 0,
  });
  await expect(page.getByRole("menuitem", { name: "Copy tag" })).toBeVisible();
  await tag.dispatchEvent("pointerup", { pointerId: 1, pointerType: "touch" });
  await page.keyboard.press("Escape");
  await tag.dispatchEvent("pointerdown", {
    pointerId: 2,
    pointerType: "touch",
    clientX: 20,
    clientY: 20,
    button: 0,
  });
  await tag.dispatchEvent("pointermove", {
    pointerId: 2,
    pointerType: "touch",
    clientX: 20,
    clientY: 60,
  });
  // Outlast the long-press timer after a scroll gesture cancels it.
  await page.waitForTimeout(650);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await tag.dispatchEvent("pointerup", { pointerId: 2, pointerType: "touch" });
});

test("a tag menu stays clickable above a nested drawer and a higher-layer dialog", async ({
  page,
}) => {
  await page.goto("/?example=products&products-display=table");
  await page.getByRole("button", { name: "Open table in drawer" }).click();
  const drawer = page.getByRole("dialog", {
    name: "Products in drawer",
    exact: true,
  });
  await expect(drawer).toBeVisible();
  await softwareTag(drawer).click();
  await page.getByRole("menuitem", { name: "Copy tag", exact: true }).click();
  await expect.poll(() => copied(page)).toBe("Workspace Pro: software");
  await expect(drawer).toBeVisible();

  await drawer.getByRole("button", { name: "Open table in dialog" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Products in dialog",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  // Consumers can layer their host dialogs above the table's default overlays.
  await dialog.evaluate((element) => {
    element.style.zIndex = "4700";
    const layer = element.closest<HTMLElement>(".yayaw-dialog-backdrop");
    if (layer) {
      layer.style.zIndex = "4600";
    }
  });
  const tag = softwareTag(dialog);
  await tag.click({ button: "right" });
  const item = page.getByRole("menuitem", { name: "Copy tag", exact: true });
  await expect(item).toBeVisible();
  await expect
    .poll(() =>
      item.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2
        );
        return hit !== null && element.contains(hit);
      })
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(tag).toBeFocused();
  await tag.click();
  await item.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(drawer).toBeVisible();
});

test("a table in a native modal keeps its tag menu in the browser top layer", async ({
  page,
}) => {
  await page.goto("/?example=products&products-display=table");
  await expect(softwareTag(page)).toBeVisible();
  // A consumer can mount the table inside a native dialog, above all body portals.
  await page.evaluate(() => {
    const content = document.querySelector("main");
    if (!content) {
      throw new Error("Products example is missing");
    }
    const host = document.createElement("dialog");
    host.setAttribute("aria-label", "Native products dialog");
    host.style.cssText = "width:95vw;max-width:none;height:90vh;padding:0";
    content.before(host);
    host.append(content);
    host.showModal();
  });
  const dialog = page.getByRole("dialog", { name: "Native products dialog" });
  const tag = softwareTag(dialog);
  await tag.click();
  const item = page.getByRole("menuitem", { name: "Copy tag", exact: true });
  await expect(item).toBeVisible();
  expect(
    await item.evaluate((element) => Boolean(element.closest("dialog[open]")))
  ).toBe(true);
  await item.click();
  await expect.poll(() => copied(page)).toBe("Workspace Pro: software");
  await tag.click({ button: "right" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(tag).toBeFocused();
});
