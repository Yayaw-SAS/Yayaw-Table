import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "public/r");
const output = resolve(root, "dist/registry-pages");

await rm(output, { force: true, recursive: true });
await mkdir(output, { recursive: true });
await cp(source, resolve(output, "r"), { recursive: true });
await writeFile(resolve(output, ".nojekyll"), "");

console.log("Prepared GitHub Pages registry artifact in dist/registry-pages.");
