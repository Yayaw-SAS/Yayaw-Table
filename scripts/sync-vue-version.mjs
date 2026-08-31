import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootPackagePath = path.join(root, "package.json");
const vuePackagePath = path.join(
  root,
  "packages",
  "yayaw-table-vue",
  "package.json"
);

const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, "utf8"));
const vuePackage = JSON.parse(fs.readFileSync(vuePackagePath, "utf8"));

if (vuePackage.version !== rootPackage.version) {
  vuePackage.version = rootPackage.version;
  fs.writeFileSync(
    vuePackagePath,
    `${JSON.stringify(vuePackage, null, 2)}\n`,
    "utf8"
  );
}

console.log(`Synchronized Vue package version to ${rootPackage.version}.`);
