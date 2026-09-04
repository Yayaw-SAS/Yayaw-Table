import { copyFile } from "node:fs/promises";

// Keep each copied registry standalone while maintaining one contract implementation.
await copyFile(
  new URL(
    "../src/components/ui/yayaw-table/utils/table-contracts.ts",
    import.meta.url
  ),
  new URL("../packages/yayaw-table-vue/src/table-contracts.ts", import.meta.url)
);
