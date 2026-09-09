import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? "dist/registry-pages");
for (const name of [
  "yayaw-table.json",
  "yayaw-table-base.json",
  "font-yayaw-sans.json",
  "yayaw-table-vue.json",
  "registry.json",
]) {
  JSON.parse(readFileSync(resolve(root, "r", name), "utf8"));
}
if (statSync(resolve(root, "vue-example/index.html")).size === 0) {
  throw new Error("The Vue example index is empty.");
}
console.log("Validated the React/Vue registry and example artifact.");
