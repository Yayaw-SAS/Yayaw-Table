import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pinSnapshotDependencies } from "../scripts/registry-snapshot-pins.mjs";

const ROOT = resolve(import.meta.dir, "..");
const PUBLIC_REGISTRY = join(ROOT, "public", "r");
const HOMEPAGE = "https://table.yayaw.app";
const CORE_URL = `${HOMEPAGE}/r/yayaw-table.json`;
const PINNED_CORE_URL = `${HOMEPAGE}/r/v9.9.9/yayaw-table.json`;
const VUE_ITEMS = [
  "yayaw-table-vue",
  "yayaw-table-vue-calendar",
  "yayaw-table-vue-chart",
  "yayaw-table-vue-dashboard",
  "yayaw-table-vue-map",
  "yayaw-table-vue-connector-notion",
  "yayaw-table-vue-connector-google-sheets",
];

interface RegistryItem {
  meta?: Record<string, unknown>;
  name: string;
  registryDependencies?: string[];
}

function pin(content: string, itemNames: string[]): string {
  return pinSnapshotDependencies(content, {
    homepage: HOMEPAGE,
    itemNames,
    version: "9.9.9",
  });
}

function readRegistryFile(fileName: string): string {
  return readFileSync(join(PUBLIC_REGISTRY, fileName), "utf8");
}

test("a pinned item depends on the same version of this registry's items", () => {
  const item = {
    files: [
      {
        content: `const core = "${CORE_URL}";`,
        path: "registry/default/ui/yayaw-table-chart/chart-view.tsx",
      },
    ],
    meta: { registryUrl: `${HOMEPAGE}/r/yayaw-table-chart.json` },
    name: "yayaw-table-chart",
    registryDependencies: [
      "button",
      "@yayaw/yayaw-table",
      "https://mapcn.dev/r/map.json",
      `${HOMEPAGE}/r/unknown-item.json`,
      CORE_URL,
    ],
  };

  const pinned = JSON.parse(
    pin(JSON.stringify(item, null, 2), ["yayaw-table", "yayaw-table-chart"])
  );

  expect(pinned.registryDependencies).toEqual([
    "button",
    "@yayaw/yayaw-table",
    "https://mapcn.dev/r/map.json",
    `${HOMEPAGE}/r/unknown-item.json`,
    PINNED_CORE_URL,
  ]);
  expect(pinned.meta).toEqual(item.meta);
  expect(pinned.files).toEqual(item.files);
});

test("the index keeps each item's latest registryUrl", () => {
  const index = {
    items: [
      { meta: { registryUrl: CORE_URL }, name: "yayaw-table" },
      {
        meta: { registryUrl: `${HOMEPAGE}/r/yayaw-table-map.json` },
        name: "yayaw-table-map",
        registryDependencies: ["button", CORE_URL],
      },
    ],
  };

  const pinned = JSON.parse(
    pin(JSON.stringify(index, null, 2), ["yayaw-table", "yayaw-table-map"])
  );

  expect(pinned.items[0]).toEqual(index.items[0]);
  expect(pinned.items[1].meta).toEqual(index.items[1].meta);
  expect(pinned.items[1].registryDependencies).toEqual([
    "button",
    PINNED_CORE_URL,
  ]);
});

test("published items only change in their registry dependencies", () => {
  const index = JSON.parse(readRegistryFile("registry.json")) as {
    items: RegistryItem[];
  };
  const itemNames = [...index.items.map((item) => item.name), ...VUE_ITEMS];
  const latestPrefix = `${HOMEPAGE}/r/`;

  for (const fileName of [
    "registry.json",
    ...itemNames.map((name) => `${name}.json`),
  ]) {
    const latest = readRegistryFile(fileName);
    const pinned = JSON.parse(pin(latest, itemNames));
    const items: RegistryItem[] = pinned.items ?? [pinned];

    for (const item of items) {
      for (const dependency of item.registryDependencies ?? []) {
        const latestItem = dependency
          .slice(latestPrefix.length)
          .replace(".json", "");
        expect(
          dependency.startsWith(latestPrefix) && itemNames.includes(latestItem)
        ).toBe(false);
      }
    }

    const unpinned = JSON.stringify(pinned).replaceAll(
      `${latestPrefix}v9.9.9/`,
      latestPrefix
    );
    expect(JSON.parse(unpinned)).toEqual(JSON.parse(latest));
  }
});
