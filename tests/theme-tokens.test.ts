import { expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const UI = "src/components/ui";
const VUE = "packages/yayaw-table-vue/src";

/** The items a theme must be able to restyle on its own. */
const REACT_ITEMS = [
  "yayaw-table",
  "yayaw-table-calendar",
  "yayaw-table-chart",
  "yayaw-table-dashboard",
  "yayaw-table-map",
];

const PALETTE_CLASS =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|accent|caret|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/\d+)?\b/g;
const COLOR_LITERAL =
  /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\b(?:rgba?|hsla?|oklch|oklab)\(/g;
/** A literal after a theme variable is its fallback: the theme still wins. */
const TOKEN_FALLBACK = /var\(--[\w-]+\s*,/;
const COMMENT_LINE = /^\s*(?:\/\/|\/?\*)/;
const SOURCE_FILE = /\.(?:ts|tsx|vue)$/;
const TEST_FILE = /\.test\.tsx?$/;

/**
 * Colours that are data or documents, not interface: each entry says why a
 * theme does not own it. Add a file here only with such a reason.
 */
const EXEMPT: Record<string, string> = {
  // Named tag colours people pick ("blue", "red") and hues derived from values.
  "yayaw-table/utils/tag-colors.ts": "tag palette (data)",
  "yayaw-table/utils/chart-model.ts": "series coloured as their option tags",
  "yayaw-table/utils/map-model.ts": "markers coloured as their option tags",
  // A printable document of its own, outside the page's theme.
  "yayaw-table/utils/export-model.ts": "printed export document",
  // Letterbox behind a video and the "+N" veil over a picture.
  "yayaw-table/feed/feed-card.tsx": "media backdrop",
  "tag-colors.ts": "tag palette (data)",
  "chart-model.ts": "series coloured as their option tags",
  "map-model.ts": "markers coloured as their option tags",
  "export-model.ts": "printed export document",
};

const walk = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "node_modules" ? [] : walk(path);
    }
    return SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)
      ? [path]
      : [];
  });

const findings = (base: string, directories: string[]): string[] => {
  const found: string[] = [];
  for (const directory of directories) {
    for (const file of walk(join(ROOT, base, directory))) {
      const name = relative(join(ROOT, base), file);
      if (name in EXEMPT) {
        continue;
      }
      const lines = readFileSync(file, "utf8").split("\n");
      for (const [index, line] of lines.entries()) {
        if (COMMENT_LINE.test(line)) {
          continue;
        }
        const literals = TOKEN_FALLBACK.test(line)
          ? []
          : (line.match(COLOR_LITERAL) ?? []);
        for (const match of [
          ...(line.match(PALETTE_CLASS) ?? []),
          ...literals,
        ]) {
          found.push(`${name}:${index + 1} ${match}`);
        }
      }
    }
  }
  return found;
};

it("styles React components with theme tokens only", () => {
  expect(findings(UI, REACT_ITEMS)).toEqual([]);
});

it("styles Vue components with theme tokens only", () => {
  expect(findings(VUE, ["."])).toEqual([]);
});
