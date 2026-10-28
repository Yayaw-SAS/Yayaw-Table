import { expect, type Locator } from "@playwright/test";
import { test } from "./fixtures/test";

/** Resolve modern CSS colors through the browser before checking contrast. */
const palette = (surface: Locator) =>
  surface.evaluate((element) => {
    const style = getComputedStyle(element);
    const context = document.createElement("canvas").getContext("2d");
    if (!context) {
      throw new Error("A canvas context is required to resolve CSS colors");
    }
    const luminance = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
      const linear = (channel: number) => {
        const value = channel / 255;
        return value <= 0.040_45
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      };
      return {
        value: 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b),
        alpha,
      };
    };
    const foreground = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return {
      background: background.value,
      alpha: background.alpha,
      contrast:
        (Math.max(foreground.value, background.value) + 0.05) /
        (Math.min(foreground.value, background.value) + 0.05),
    };
  });

for (const theme of ["light", "dark"]) {
  test(`${theme}: select options are readable and preserve the selected value`, async ({
    page,
  }, testInfo) => {
    const vue = testInfo.project.name === "vue";
    // Exercise the local Vue inline editor and the equivalent React form select.
    await page.goto(`/?theme=${theme}${vue ? "" : "&example=records"}`);
    const row = page.getByRole("row").filter({
      has: page.getByText("Product 1", { exact: true }),
    });
    if (vue) {
      await row.locator('[data-column-id="status"] .yayaw-cell').click();
    } else {
      await page.getByRole("button", { name: "Add item" }).click();
    }
    const select = page.getByRole("combobox", {
      name: "Status",
      exact: true,
      includeHidden: true,
    });
    if (!vue) {
      await select.click();
    }
    await expect(select).toHaveAttribute("data-slot", "select-trigger");
    const surface = page.locator('[data-slot="select-content"]');
    const colors = await palette(surface);
    expect(colors.alpha).toBe(255);
    expect(colors.contrast).toBeGreaterThanOrEqual(4.5);
    if (theme === "dark") {
      expect(colors.background).toBeLessThan(0.1);
    } else {
      expect(colors.background).toBeGreaterThan(0.8);
    }
    await page.screenshot({ path: testInfo.outputPath("select-popup.png") });
    if (vue) {
      await page
        .getByRole("option", { name: "Low Stock", exact: true })
        .click();
      await expect(row.locator('[data-column-id="status"]')).toHaveText(
        "Low Stock"
      );
      await row.locator('[data-column-id="status"] .yayaw-cell').click();
      await expect(
        page.getByRole("option", { name: "Low Stock", exact: true })
      ).toHaveAttribute("aria-selected", "true");
    } else {
      await page.getByRole("option", { name: "Draft", exact: true }).click();
      await expect(select).toContainText("Draft");
      await select.click();
      await expect(
        page.getByRole("option", { name: "Draft", exact: true })
      ).toHaveAttribute("aria-selected", "true");
    }
  });
}
