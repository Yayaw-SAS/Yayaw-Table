import { expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const TYPESCRIPT_FILE = /\.tsx?$/;

it("keeps React client boundaries in the directive prologue before registry generation", () => {
  const directory = join(import.meta.dir, "../src/components/ui/yayaw-table");
  for (const entry of readdirSync(directory, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!(entry.isFile() && TYPESCRIPT_FILE.test(entry.name))) {
      continue;
    }
    const path = join(entry.parentPath, entry.name);
    const source = readFileSync(path, "utf8");
    if (!source.includes('"use client";')) {
      continue;
    }
    const parsed = ts.createSourceFile(
      path,
      source,
      ts.ScriptTarget.Latest,
      true
    );
    const first = parsed.statements[0];
    // Imports before the boundary become a parenthesized expression in the
    // registry formatter and are rejected by Next.js even inside a client tree.
    expect(first && ts.isExpressionStatement(first), path).toBe(true);
    if (first && ts.isExpressionStatement(first)) {
      expect(ts.isStringLiteral(first.expression), path).toBe(true);
      if (ts.isStringLiteral(first.expression)) {
        expect(first.expression.text, path).toBe("use client");
      }
    }
  }
});
