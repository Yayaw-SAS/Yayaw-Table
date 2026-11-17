import { describe, it } from "bun:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { build as bundle } from "bun";

const DATA_TABLE = resolve(
  import.meta.dir,
  "../src/components/ui/yayaw-table/components/data-table.tsx"
);

// Views, panels and dialogs a visitor opens on demand: their code must not
// ship with the table's first download.
const ON_DEMAND_MODULES = [
  "components/bulk-actions/bulk-actions-menu.tsx",
  "components/forms/catalogue-bulk-editor.tsx",
  "components/toolbar/connector-panel.tsx",
  "components/toolbar/export-panel.tsx",
  "components/toolbar/import-panel.tsx",
  "filetree/filetree-view.tsx",
  "form/form-view.tsx",
  "node_modules/@tanstack/react-form",
  "node_modules/framer-motion",
  "node_modules/motion-dom",
];

describe("table first download", () => {
  it("leaves the on-demand views out of the table's main chunk", async () => {
    const build = await bundle({
      entrypoints: [DATA_TABLE],
      external: ["*.css"],
      metafile: true,
      splitting: true,
      target: "browser",
    });
    assert.ok(build.success, build.logs.join("\n"));
    const outputs = Object.values(build.metafile?.outputs ?? {});
    const main = outputs.reduce((largest, output) =>
      output.bytes > largest.bytes ? output : largest
    );
    const eager = Object.keys(main.inputs);
    for (const module of ON_DEMAND_MODULES) {
      assert.equal(
        eager.some((input) => input.includes(module)),
        false,
        `${module} loads with the table`
      );
    }
  }, 60_000);
});
