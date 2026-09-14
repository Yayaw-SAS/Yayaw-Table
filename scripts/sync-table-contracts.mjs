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
