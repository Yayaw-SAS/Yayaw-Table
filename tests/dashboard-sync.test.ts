import { expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const REACT_DASHBOARD = "src/components/ui/yayaw-table-dashboard";
const VUE = "packages/yayaw-table-vue/src";
/** The table's shared helpers sit in `utils/` next to the React table and beside the Vue files. */
const toVueDashboard = (content: string) =>
  content.replaceAll("../yayaw-table/utils/", "../");

/** Files `scripts/sync-table-contracts.mjs` copies into the Vue edition, and how their paths change. */
const SYNCED: [
  react: string,
  vue: string,
  rewrite: (content: string) => string,
][] = [
  ...[
    "dashboard-schema.ts",
    "dashboard-sources.ts",
    "dashboard-layout.ts",
    "dashboard-model.ts",
    "dashboard-fit.ts",
    "dashboard-grid-engine.ts",
    "dashboard-grid.css",
  ].map((name): [string, string, (content: string) => string] => [
    `${REACT_DASHBOARD}/${name}`,
    `${VUE}/dashboard/${name}`,
    toVueDashboard,
  ]),
  [
    "src/components/ui/yayaw-table/utils/view-config.ts",
    `${VUE}/view-config.ts`,
    (content) => content.replaceAll("../planning/", "./planning/"),
  ],
];

for (const [react, vue, rewrite] of SYNCED) {
  it(`${vue} is ${react} with the Vue paths (run bun run contracts:sync)`, () => {
    expect(readFileSync(vue, "utf8")).toBe(
      rewrite(readFileSync(react, "utf8"))
    );
  });
}

it("the sync script copies every shared dashboard file", () => {
  const script = readFileSync("scripts/sync-table-contracts.mjs", "utf8");
  for (const [react] of SYNCED) {
    expect(script).toContain(react.split("/").at(-1) ?? react);
  }
});
