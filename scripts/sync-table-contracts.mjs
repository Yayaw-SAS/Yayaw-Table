import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";

await copyFile(
  new URL(
    "../src/components/ui/yayaw-table/components/details/record-details.css",
    import.meta.url
  ),
  new URL("../packages/yayaw-table-vue/src/record-details.css", import.meta.url)
);

await copyFile(
  new URL(
    "../src/components/ui/yayaw-table/utils/filter-bar.ts",
    import.meta.url
  ),
  new URL("../packages/yayaw-table-vue/src/filter-bar.ts", import.meta.url)
);

await copyFile(
  new URL(
    "../src/components/ui/yayaw-table/utils/record-details.ts",
    import.meta.url
  ),
  new URL("../packages/yayaw-table-vue/src/record-details.ts", import.meta.url)
);

await copyFile(
  new URL(
    "../src/components/ui/yayaw-table/utils/table-view-favorite.ts",
    import.meta.url
  ),
  new URL(
    "../packages/yayaw-table-vue/src/table-view-favorite.ts",
    import.meta.url
  )
);

for (const file of [
  "calendar-model.ts",
  "view-tabs.ts",
  "display-modes.ts",
  "scoped-rows.ts",
  "manual-order.ts",
  "list-view.ts",
  "value-format.ts",
  "server-kanban.ts",
  "selection-interaction.ts",
  "selection-shortcuts.ts",
  "activity-shortcuts.ts",
  "duplicate-shortcut.ts",
  "media-contract.ts",
  "gallery-view-state.ts",
  "media-viewer.ts",
  "media-viewer.css",
  "tag-colors.ts",
  "tag-colors.css",
]) {
  await copyFile(
    new URL(`../src/components/ui/yayaw-table/utils/${file}`, import.meta.url),
    new URL(`../packages/yayaw-table-vue/src/${file}`, import.meta.url)
  );
}

// Keep each copied registry standalone while maintaining one contract implementation.
await copyFile(
  new URL(
    "../src/components/ui/yayaw-table/utils/table-contracts.ts",
    import.meta.url
  ),
  new URL("../packages/yayaw-table-vue/src/table-contracts.ts", import.meta.url)
);

await copyFile(
  new URL(
    "../src/components/ui/yayaw-table/utils/auto-page-size.ts",
    import.meta.url
  ),
  new URL("../packages/yayaw-table-vue/src/auto-page-size.ts", import.meta.url)
);

await copyFile(
  new URL(
    "../src/components/ui/yayaw-table/utils/form-layout.ts",
    import.meta.url
  ),
  new URL("../packages/yayaw-table-vue/src/form-layout.ts", import.meta.url)
);

await copyFile(
  new URL(
    "../src/components/ui/yayaw-table/utils/row-selection-range.ts",
    import.meta.url
  ),
  new URL(
    "../packages/yayaw-table-vue/src/row-selection-range.ts",
    import.meta.url
  )
);

await copyFile(
  new URL(
    "../src/components/ui/yayaw-table/utils/view-menu.ts",
    import.meta.url
  ),
  new URL("../packages/yayaw-table-vue/src/view-menu.ts", import.meta.url)
);

await copyFile(
  new URL(
    "../src/components/ui/yayaw-table/utils/bulk-editor.ts",
    import.meta.url
  ),
  new URL("../packages/yayaw-table-vue/src/bulk-editor.ts", import.meta.url)
);

// The planning engine, controller and native renderer have identical behavior in both editions.
const planningSource = new URL(
  "../src/components/ui/yayaw-table/planning/",
  import.meta.url
);
const planningTarget = new URL(
  "../packages/yayaw-table-vue/src/planning/",
  import.meta.url
);
await mkdir(planningTarget, { recursive: true });
for (const name of await readdir(planningSource)) {
  if (/\.(ts|css)$/.test(name) && !name.includes(".test.")) {
    const content = await readFile(new URL(name, planningSource), "utf8");
    await writeFile(
      new URL(name, planningTarget),
      content.replaceAll("../utils/table-contracts", "../table-contracts")
    );
  }
}

// Record presentation and surface tokens are identical in both registries.
for (const [source, target] of [
  ["utils/record-presentation.ts", "record-presentation.ts"],
  ["components/records/record-surface.css", "record-surface.css"],
]) {
  await copyFile(
    new URL(`../src/components/ui/yayaw-table/${source}`, import.meta.url),
    new URL(`../packages/yayaw-table-vue/src/${target}`, import.meta.url)
  );
}
