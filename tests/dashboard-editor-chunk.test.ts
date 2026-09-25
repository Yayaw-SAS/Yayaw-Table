import { expect, it } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";

const ROOT = resolve(import.meta.dir, "..");
const REACT = "src/components/ui/yayaw-table-dashboard";
const VUE = "packages/yayaw-table-vue/src/dashboard";
const SCRIPT_BLOCK = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
const EXTENSIONS = ["", ".ts", ".tsx"];

/**
 * The screen editor is a chunk of its own: readers download the screen, and
 * edit mode imports the editor (`import()` in React, `defineAsyncComponent`
 * in Vue). Each edition lists the modules only the editor loads.
 */
const EDITIONS = [
  {
    name: "React",
    directory: REACT,
    entry: "yayaw-dashboard.tsx",
    editor: "dashboard-editor.tsx",
    editorOnly: [
      "dashboard-editor.tsx",
      "dashboard-dialogs.tsx",
      "dashboard-widget-dialog.tsx",
      "dashboard-source-picker.tsx",
      "dashboard-view-editor.tsx",
    ],
  },
  {
    name: "Vue",
    directory: VUE,
    entry: "YayawDashboard.vue",
    editor: "DashboardEditorLayer.vue",
    editorOnly: [
      "DashboardEditorLayer.vue",
      "DashboardWidgetDialog.vue",
      "DashboardSourcePicker.vue",
      "DashboardViewEditor.vue",
      "DashboardAddFilter.vue",
      "DashboardKpiFields.vue",
      "DashboardBlockProps.vue",
    ],
  },
];

const isTypeOnlyImport = (node: ts.ImportDeclaration): boolean => {
  const clause = node.importClause;
  if (!clause) {
    return false;
  }
  const bindings = clause.namedBindings;
  return (
    clause.isTypeOnly ||
    (!clause.name &&
      bindings !== undefined &&
      ts.isNamedImports(bindings) &&
      bindings.elements.length > 0 &&
      bindings.elements.every((element) => element.isTypeOnly))
  );
};

const isDynamicImport = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) &&
  node.expression.kind === ts.SyntaxKind.ImportKeyword;

/** A module's code: a `.vue` file's script blocks, else the whole file. */
function codeOf(file: string): string {
  const text = readFileSync(join(ROOT, file), "utf8");
  if (!file.endsWith(".vue")) {
    return text;
  }
  return [...text.matchAll(SCRIPT_BLOCK)]
    .map((match) => match[1] ?? "")
    .join("\n");
}

/** What a module loads when it runs, and what it imports on demand. */
function importsOf(file: string) {
  const source = ts.createSourceFile(
    file,
    codeOf(file),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const loaded: string[] = [];
  const onDemand: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !isTypeOnlyImport(node)
    ) {
      loaded.push(node.moduleSpecifier.text);
    } else if (isDynamicImport(node)) {
      const [specifier] = node.arguments;
      if (specifier && ts.isStringLiteral(specifier)) {
        onDemand.push(specifier.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { loaded, onDemand };
}

/** A relative import's file, when it is one of the screen's modules. */
function resolveIn(directory: string, from: string, specifier: string) {
  if (!specifier.startsWith(".")) {
    return;
  }
  const base = join(dirname(from), specifier);
  return EXTENSIONS.map((extension) => `${base}${extension}`).find(
    (candidate) =>
      dirname(candidate) === directory &&
      existsSync(join(ROOT, candidate)) &&
      statSync(join(ROOT, candidate)).isFile()
  );
}

/** The screen's modules a module loads, directly or not, and those it imports on demand. */
function walk(directory: string, entry: string) {
  const files = new Set<string>();
  const onDemand = new Set<string>();
  const queue = [`${directory}/${entry}`];
  while (queue.length > 0) {
    const file = queue.shift() ?? "";
    if (files.has(file)) {
      continue;
    }
    files.add(file);
    const imports = importsOf(file);
    for (const specifier of imports.loaded) {
      const local = resolveIn(directory, file, specifier);
      if (local) {
        queue.push(local);
      }
    }
    for (const specifier of imports.onDemand) {
      const local = resolveIn(directory, file, specifier);
      if (local) {
        onDemand.add(local);
      }
    }
  }
  return { files, onDemand };
}

for (const edition of EDITIONS) {
  const path = (name: string) => `${edition.directory}/${name}`;

  it(`${edition.name}: readers never load the editor; edit mode imports it on demand`, () => {
    const reader = walk(edition.directory, edition.entry);
    expect(
      edition.editorOnly.filter((name) => reader.files.has(path(name)))
    ).toEqual([]);
    expect([...reader.onDemand]).toContain(path(edition.editor));
  });

  it(`${edition.name}: the editor chunk holds the dialogs, the catalogue and the view editor`, () => {
    const editor = walk(edition.directory, edition.editor);
    expect(
      edition.editorOnly.filter((name) => !editor.files.has(path(name)))
    ).toEqual([]);
  });
}
