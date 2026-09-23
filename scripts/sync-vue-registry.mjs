import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

for (const name of ["yayaw-table-vue", "yayaw-table-vue-calendar"]) {
  const source = resolve(
    root,
    `packages/yayaw-table-vue/public/r/${name}.json`
  );
  const target = resolve(root, `public/r/${name}.json`);
  const registryItem = JSON.parse(await readFile(source, "utf8"));

  if (registryItem.name !== name) {
    throw new Error(`Unexpected Vue registry item name: ${registryItem.name}`);
  }

  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  console.log(`Synced Vue registry item to public/r/${name}.json.`);
}
