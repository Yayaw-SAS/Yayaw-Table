import { copyFile } from "node:fs/promises";

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
