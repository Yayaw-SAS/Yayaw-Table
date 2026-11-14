import { expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const UI = "src/components/ui";
const VUE = "packages/yayaw-table-vue/src";

const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

const ESCAPED = /[.*+?^${}()|[\]\\]/g;

/** The declarations of the first rule whose selector is exactly `selector`. */
const rule = (css: string, selector: string): string => {
  const pattern = new RegExp(
    `(?:^|\\})\\s*(?:/\\*[^*]*\\*/\\s*)?${selector.replace(ESCAPED, "\\$&")}\\s*\\{([^}]*)\\}`,
    "m"
  );
  return pattern.exec(css)?.[1] ?? "";
};

/** The line of a React source that carries `marker`, with its neighbours. */
const around = (source: string, marker: string, lines = 6): string => {
  const all = source.split("\n");
  const index = all.findIndex((line) => line.includes(marker));
  return index < 0
    ? ""
    : all.slice(Math.max(0, index - lines), index + lines).join("\n");
};

it("draws a pressed linked number on the accent surface in both editions", () => {
  const react = read(`${UI}/yayaw-table-dashboard/dashboard-widget.tsx`);
  const active = around(react, "link?.active &&", 3);
  expect(active).toContain("bg-accent");
  expect(active).toContain("text-accent-foreground");
  expect(active).toContain("border-primary");
  expect(active).toContain("ring-primary");
  expect(react).not.toContain("bg-primary/5");

  const vue = rule(
    read(`${VUE}/dashboard/dashboard.css`),
    ".yayaw-dashboard-widget[data-link-active]"
  );
  expect(vue).toContain("background: var(--accent, var(--yayaw-muted))");
  expect(vue).toContain(
    "color: var(--accent-foreground, var(--yayaw-foreground))"
  );
  expect(vue).toContain("border-color: var(--yayaw-primary)");
});

it("draws the selected view tab on the accent surface in both editions", () => {
  const react = around(
    read(`${UI}/yayaw-table/components/toolbar/table-view-tabs.tsx`),
    "aria-selected={active}",
    10
  );
  expect(react).toContain("bg-accent");
  expect(react).toContain("text-accent-foreground");

  const vue = rule(
    read(`${VUE}/styles.css`),
    ".yayaw-view-tab.yayaw-button-secondary"
  );
  expect(vue).toContain("background: var(--accent, var(--yayaw-muted))");
  expect(vue).toContain(
    "color: var(--accent-foreground, var(--yayaw-foreground))"
  );
});

it("draws the bulk action bar as a primary pill in both editions", () => {
  const react = around(
    read(`${UI}/yayaw-table/components/bulk-actions/bulk-actions-menu.tsx`),
    'data-slot="bulk-actions-bar"',
    2
  );
  expect(react).toContain("bg-primary");
  expect(react).toContain("text-primary-foreground");
  expect(react).toContain("rounded-full");
  expect(react).toContain("shadow-xl");

  const vue = rule(read(`${VUE}/styles.css`), ".yayaw-bulk-bar");
  expect(vue).toContain("background: var(--yayaw-primary)");
  expect(vue).toContain("color: var(--yayaw-primary-foreground)");
  expect(vue).toContain("border-radius: 9999px");
  expect(vue).toContain("box-shadow:");
});

it("lets a theme shape tags in both editions", () => {
  for (const path of [
    `${UI}/yayaw-table/utils/tag-colors.css`,
    `${VUE}/tag-colors.css`,
  ]) {
    const tag = rule(read(path), ".yayaw-tag");
    expect(tag).toContain("border-radius: var(--yayaw-tag-radius, 0.35rem)");
    expect(tag).toContain("font-weight: var(--yayaw-tag-font-weight, 400)");
  }
  expect(rule(read(`${VUE}/styles.css`), ".yayaw-tag")).toContain(
    "border-radius: var(--yayaw-tag-radius, 0.35rem)"
  );
});
