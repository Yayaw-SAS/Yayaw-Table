import { expect, it } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";

const ROOT = resolve(import.meta.dir, "..");
const VUE = "packages/yayaw-table-vue/src";
/** Modules hosts run on their servers (validation, AI tools), in both editions. */
const ENTRIES = [
  "src/components/ui/yayaw-table-dashboard/dashboard-schema.ts",
  "src/components/ui/yayaw-table-dashboard/dashboard-sources.ts",
  "src/components/ui/yayaw-table-dashboard/dashboard-editor-model.ts",
  "src/components/ui/yayaw-table/utils/view-config.ts",
  "src/components/ui/yayaw-table/utils/view-order.ts",
  "src/components/ui/yayaw-table/utils/facets-model.ts",
  "src/components/ui/yayaw-table/utils/folder-directory.ts",
  `${VUE}/dashboard/dashboard-schema.ts`,
  `${VUE}/dashboard/dashboard-sources.ts`,
  `${VUE}/dashboard/dashboard-editor-model.ts`,
  `${VUE}/view-config.ts`,
  `${VUE}/view-order.ts`,
  `${VUE}/facets-model.ts`,
  `${VUE}/folder-directory.ts`,
];
const UI_PACKAGE =
  /^(?:react|react-dom|vue|next|reka-ui|jotai|nuqs|sonner|vue-sonner|lucide-react|lucide-vue-next)(?:\/|$)|^@(?:vue|base-ui|tanstack\/(?:react|vue)-[\w-]+)(?:\/|$)/;
const STYLESHEET = /\.(?:css|scss|sass|less)(?:\?.*)?$/;
const EXTENSIONS = [".ts", ".tsx", ".mts", "/index.ts", "/index.tsx"];

const isTypeOnlyImport = (node: ts.ImportDeclaration): boolean => {
  const clause = node.importClause;
  if (!clause) {
    return false;
  }
  if (clause.isTypeOnly) {
    return true;
  }
  const bindings = clause.namedBindings;
  return (
    !clause.name &&
    bindings !== undefined &&
    ts.isNamedImports(bindings) &&
    bindings.elements.length > 0 &&
    bindings.elements.every((element) => element.isTypeOnly)
  );
};

const isTypeOnlyExport = (node: ts.ExportDeclaration): boolean =>
  node.isTypeOnly ||
  (node.exportClause !== undefined &&
    ts.isNamedExports(node.exportClause) &&
    node.exportClause.elements.length > 0 &&
    node.exportClause.elements.every((element) => element.isTypeOnly));

/** Module specifiers a file loads when it runs (type-only imports are erased). */
function runtimeImports(source: ts.SourceFile): string[] {
  const specifiers: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !isTypeOnlyImport(node)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !isTypeOnlyExport(node)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

const hasClientDirective = (source: ts.SourceFile): boolean =>
  source.statements.some(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression) &&
      statement.expression.text === "use client"
  );

/** A local module's file: relative, or the `@/` alias of its edition. */
function resolveLocal(from: string, specifier: string): string | undefined {
  let base: string | undefined;
  if (specifier.startsWith(".")) {
    base = join(dirname(from), specifier);
  } else if (specifier.startsWith("@/")) {
    const react = specifier.startsWith("@/src/")
      ? specifier.slice(2)
      : `src/${specifier.slice(2)}`;
    base = from.startsWith(VUE) ? `${VUE}/${specifier.slice(2)}` : react;
  }
  if (base === undefined) {
    return;
  }
  const candidates = [
    base,
    ...EXTENSIONS.map((extension) => `${base}${extension}`),
  ];
  return candidates.find((candidate) => {
    const path = join(ROOT, candidate);
    return existsSync(path) && statSync(path).isFile();
  });
}

/** Every local file a module loads at runtime, and what it loads that a server cannot. */
function walk(entry: string) {
  const files = new Set<string>();
  const problems: string[] = [];
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift() ?? "";
    if (files.has(file)) {
      continue;
    }
    files.add(file);
    const text = readFileSync(join(ROOT, file), "utf8");
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true
    );
    if (hasClientDirective(source)) {
      problems.push(`${file} is a client module ("use client")`);
    }
    for (const specifier of runtimeImports(source)) {
      if (STYLESHEET.test(specifier)) {
        problems.push(`${file} imports a stylesheet: ${specifier}`);
      } else if (UI_PACKAGE.test(specifier)) {
        problems.push(`${file} imports ${specifier}`);
      } else {
        const local = resolveLocal(file, specifier);
        if (local) {
          queue.push(relative(ROOT, join(ROOT, local)));
        } else if (specifier.startsWith(".") || specifier.startsWith("@/")) {
          problems.push(`${file} imports ${specifier}, which does not resolve`);
        }
      }
    }
  }
  return { files, problems };
}

/**
 * Files the walk must pass to show it follows the table's own helpers: view
 * settings reach every mode's normalizer, facets and folders the chart and
 * file tree models; the sources and the order of views stand alone.
 */
function minimumWalk(entry: string): number {
  if (entry.includes("sources") || entry.endsWith("view-order.ts")) {
    return 0;
  }
  if (
    entry.endsWith("facets-model.ts") ||
    entry.endsWith("folder-directory.ts")
  ) {
    return 4;
  }
  return 8;
}

for (const entry of ENTRIES) {
  it(`${entry} runs on a server: no React, Vue, CSS or client module in its imports`, () => {
    const { files, problems } = walk(entry);
    expect(problems).toEqual([]);
    expect(files.size).toBeGreaterThan(minimumWalk(entry));
  });
}

it("the walk catches client modules, framework imports and stylesheets", () => {
  const { problems } = walk(
    "src/components/ui/yayaw-table-dashboard/dashboard-grid.tsx"
  );
  expect(problems.some((problem) => problem.includes('"use client"'))).toBe(
    true
  );
  expect(problems.some((problem) => problem.includes("imports react"))).toBe(
    true
  );
  expect(problems.some((problem) => problem.includes("stylesheet"))).toBe(true);
});
