import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(
  root,
  "packages/yayaw-table-vue/public/r/yayaw-table-vue.json"
);
const target = resolve(root, "public/r/yayaw-table-vue.json");
const registryItem = JSON.parse(await readFile(source, "utf8"));

if (registryItem.name !== "yayaw-table-vue") {
  throw new Error(`Unexpected Vue registry item name: ${registryItem.name}`);
}

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);

console.log("Synced Vue registry item to public/r/yayaw-table-vue.json.");
