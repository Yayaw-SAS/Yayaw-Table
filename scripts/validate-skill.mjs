/**
 * Validates the agent skill in `skills/yayaw-table` against the code, so the
 * skill cannot drift silently:
 *
 * - `SKILL.md` has Agent Skills frontmatter (`name`, `description`) and stays
 *   short; every reference file is linked from it.
 * - Relative links resolve inside the skill (it is copied on its own) and
 *   GitHub links to this repository point at files and headings that exist.
 * - Checked tables (`<!-- skill-check: <id> -->` before a Markdown table) list
 *   exactly what the code declares: display modes, column types, filter
 *   operators, list scope kinds, registry items, and the members of the action
 *   and connector contracts. Both editions must agree.
 * - Anywhere in the skill, `actions.*` names, `scope: { kind }` values,
 *   `helper()` names, file paths and `@/components/ui/yayaw-table*` imports
 *   exist in the code.
 *
 * Run: `bun run skill:check` (also part of `bun run check`).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const SKILL_NAME = "yayaw-table";
const REACT = "src/components/ui/yayaw-table";
const VUE = "packages/yayaw-table-vue/src";
const OPTIONAL_REACT_ITEMS = ["calendar", "chart", "dashboard", "map"];
const GITHUB_PREFIX = "https://github.com/Yayaw-SAS/Yayaw-Table/";

const MAX_SKILL_LINES = 500;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const FRONTMATTER_KEYS = new Set([
  "allowed-tools",
  "compatibility",
  "description",
  "license",
  "metadata",
  "name",
]);
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".vue", ".mjs"];
const NOT_INSTALLED = /(\.test\.|\.spec\.|\/env\.d\.ts$|\/public-types\.ts$)/;

const FRONTMATTER_ENTRY = /^([A-Za-z][\w-]*):(?:\s+(.*))?$/;
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FENCE = /^\s*(?:```|~~~)/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const CODE_SPAN = /`([^`\n]+)`/g;
const CHECK_MARKER = /^<!--\s*skill-check:\s*([\w.-]+)\s*-->$/;
const TABLE_SEPARATOR = /^\|?[\s:|-]+\|?$/;
const TABLE_CELL_SPLIT = /(?<!\\)\|/;
const ACTION_REFERENCE = /(?<![\w$.])actions\.([A-Za-z]+)(?:\.([A-Za-z]+))?/g;
const SCOPE_REFERENCE = /scope:\s*\{\s*kind:\s*"([^"]+)"/g;
const HELPER_REFERENCE = /^([A-Za-z_$][\w$]*)\(\)$/;
const PATH_REFERENCE =
  /^(?:components\/ui|src|packages|docs|tests|e2e|examples|scripts|registry|\.github)\/[\w./-]+$/;
const IMPORT_STATEMENT =
  /import\s+(type\s+)?([\w$]+)?\s*,?\s*(?:\{([^}]*)\})?\s*from\s*"(@\/components\/ui\/yayaw-table[^"]*)"/g;
const EXPORT_DECLARATION =
  /export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
const EXPORT_LIST = /export\s+(?:type\s+)?\{([^}]*)\}/g;
const EXPORT_STAR = /export\s+(?:type\s+)?\*\s+from\s+"(\.[^"]+)"/g;
const KIND_FIELD = /^\s*kind:\s*"([\w-]+)";/gm;
const VUE_ITEM_NAME = /name:\s*"(yayaw-table-vue[\w-]*)"/g;
const SLUG_REMOVED = /[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu;
const MARKDOWN_DECORATION = /[`*]/g;
const MARKDOWN_LINK_TEXT = /\[([^\]]*)\]\([^)]*\)/g;
const SCHEME = /^[a-z][a-z\d+.-]*:/i;
const TYPE_MODIFIER = /^type\s+/;
const AS_KEYWORD = /\s+as\s+/;
const ANGLE_BRACKET = /[<>]/;
const GITHUB_FILE = /^(blob|tree)\/main\/([^#?]+)(?:#(.+))?$/;
const TRAILING_SLASH = /\/$/;
const MODULE_REFERENCE = /^@\/components\/ui\/yayaw-table[\w./-]*$/;

/** A declaration found in both editions: [React file, Vue file, name]. */
const inBoth = (react, vue, name) => [
  [`${REACT}/${react}`, name],
  [`${VUE}/${vue}`, name],
];
const objectKeysOf = (...source) => ({
  kind: "objectKeys",
  sources: inBoth(...source),
});
/** Members of a contract; the table lists them as `<check id>.<member>`. */
const membersOf = (...source) => ({
  kind: "members",
  sources: inBoth(...source),
});

/** Checked tables: what their first column must list, derived from the code. */
const TABLE_CHECKS = {
  "display-modes": objectKeysOf(
    "utils/display-modes.ts",
    "display-modes.ts",
    "DISPLAY_MODES"
  ),
  "column-types": objectKeysOf(
    "utils/table-contracts.ts",
    "table-contracts.ts",
    "TABLE_DATA_TYPES"
  ),
  // React lists operators per column type, Vue in one union: hosts get both.
  "filter-operators": {
    kind: "literals",
    union: true,
    sources: [
      [`${REACT}/types/filter-types.ts`, "FilterOperators"],
      [`${VUE}/types.ts`, "AdvancedFilterOperator"],
    ],
  },
  scopes: { kind: "scopes" },
  "registry-items": { kind: "registryItems" },
  actions: membersOf(
    "providers/table-provider.tsx",
    "types.ts",
    "TableActions"
  ),
  "actions.views": membersOf(
    "types/view-types.ts",
    "types.ts",
    "TableViewActions"
  ),
  "actions.tree": membersOf(
    "utils/filetree-model.ts",
    "filetree-model.ts",
    "FileTreeActions"
  ),
  "actions.import": membersOf(
    "utils/import-flow.ts",
    "import-flow.ts",
    "TableImportActions"
  ),
  "actions.formLinks": membersOf(
    "utils/form-view.ts",
    "form-view.ts",
    "FormLinkActions"
  ),
  "actions.planning": membersOf(
    "planning/types.ts",
    "planning/types.ts",
    "TablePlanningActions"
  ),
  "actions.dashboards": membersOf(
    "../yayaw-table-dashboard/dashboard-model.ts",
    "dashboard/dashboard-model.ts",
    "DashboardStorage"
  ),
  // What a dashboard block component receives.
  props: membersOf(
    "../yayaw-table-dashboard/dashboard-block.tsx",
    "dashboard/dashboard-types.ts",
    "DashboardBlockProps"
  ),
  "table.facets": membersOf(
    "utils/facets-model.ts",
    "facets-model.ts",
    "TableFacetsConfig"
  ),
  destination: membersOf(
    "utils/data-destinations.ts",
    "data-destinations.ts",
    "DataDestination"
  ),
  connector: membersOf(
    "utils/connector-flow.ts",
    "connector-flow.ts",
    "DataDestinationConnector"
  ),
  schedule: membersOf(
    "utils/schedule-model.ts",
    "schedule-model.ts",
    "DataDestinationSchedule"
  ),
};

/** `actions.dashboards` belongs to `YayawDashboard`, not to the table. */
const DASHBOARD_PROPS = [
  "src/components/ui/yayaw-table-dashboard/yayaw-dashboard.tsx",
  "YayawDashboardProps",
];

/** Installed path prefixes (registry targets) and the sources they come from. */
const INSTALLED_ROOTS = [
  ["components/ui/yayaw-table-vue", VUE],
  ["components/ui/yayaw-table/ui-custom", "src/components/ui/custom"],
  [
    "components/ui/yayaw-table/components/filters/calendar.tsx",
    "src/components/ui/calendar.tsx",
  ],
  ["components/ui/yayaw-table", REACT],
  ...OPTIONAL_REACT_ITEMS.map((item) => [
    `components/ui/yayaw-table-${item}`,
    `src/components/ui/yayaw-table-${item}`,
  ]),
];

// Files ------------------------------------------------------------------------

const cache = new Map();

function readRepoFile(root, relativePath) {
  const absolute = path.join(root, relativePath);
  if (!cache.has(absolute)) {
    cache.set(
      absolute,
      fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : undefined
    );
  }
  return cache.get(absolute);
}

function listFiles(directory, predicate) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs
    .readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name))
    .filter(predicate)
    .sort();
}

/** Repository path a registry target (`components/ui/yayaw-table/…`) is copied from. */
export function sourceOfInstalledPath(installedPath) {
  for (const [target, source] of INSTALLED_ROOTS) {
    if (installedPath === target) {
      return source;
    }
    if (installedPath.startsWith(`${target}/`)) {
      return `${source}${installedPath.slice(target.length)}`;
    }
  }
  return;
}

function installedFileExists(root, installedPath) {
  const source = sourceOfInstalledPath(installedPath);
  return Boolean(
    source &&
      !NOT_INSTALLED.test(source) &&
      fs.existsSync(path.join(root, source))
  );
}

/** A module specifier resolved like the bundler: extension, then index file. */
function resolveModule(root, modulePath) {
  const candidates = [
    modulePath,
    ...SOURCE_EXTENSIONS.map((extension) => `${modulePath}${extension}`),
    `${modulePath}/index.ts`,
  ];
  return candidates.find((candidate) => {
    const absolute = path.join(root, candidate);
    return (
      !NOT_INSTALLED.test(candidate) &&
      fs.existsSync(absolute) &&
      fs.statSync(absolute).isFile()
    );
  });
}

// Exports ------------------------------------------------------------------------

/**
 * Names in `{ a, type B, c as d }`: the exported side (`d`) of an export
 * list, or the imported side (`c`) of an import list.
 */
function specifierNames(list, side) {
  return list
    .split(",")
    .map((entry) => entry.trim().replace(TYPE_MODIFIER, ""))
    .filter(Boolean)
    .map((entry) => {
      const [local, alias] = entry.split(AS_KEYWORD);
      return (side === "local" ? local : (alias ?? local)).trim();
    });
}

/** Names a file exports itself: declarations and `export { … }` lists. */
function ownExports(text) {
  return [
    ...[...text.matchAll(EXPORT_DECLARATION)].map(([, name]) => name),
    ...[...text.matchAll(EXPORT_LIST)].flatMap(([, list]) =>
      specifierNames(list, "exported")
    ),
  ];
}

/** Names a module exports, following `export * from "./…"`. */
function moduleExports(root, file, seen = new Set()) {
  if (seen.has(file)) {
    return new Set();
  }
  seen.add(file);
  const text = readRepoFile(root, file) ?? "";
  const names = new Set(ownExports(text));
  for (const [, specifier] of text.matchAll(EXPORT_STAR)) {
    const target = resolveModule(
      root,
      path.posix.join(path.posix.dirname(file), specifier)
    );
    for (const name of target ? moduleExports(root, target, seen) : []) {
      names.add(name);
    }
  }
  return names;
}

function allExportedNames(root) {
  const roots = [
    REACT,
    VUE,
    ...OPTIONAL_REACT_ITEMS.map(
      (item) => `src/components/ui/yayaw-table-${item}`
    ),
  ];
  const names = new Set();
  for (const directory of roots) {
    const files = listFiles(
      path.join(root, directory),
      (file) =>
        (file.endsWith(".ts") || file.endsWith(".tsx")) &&
        !NOT_INSTALLED.test(file)
    );
    for (const file of files) {
      for (const name of ownExports(fs.readFileSync(file, "utf8"))) {
        names.add(name);
      }
    }
  }
  return names;
}

// TypeScript declarations ----------------------------------------------------------

function sourceFile(root, file) {
  const text = readRepoFile(root, file);
  if (text === undefined) {
    throw new Error(`${file} is missing.`);
  }
  return ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
}

function findDeclaration(root, file, name) {
  let found;
  const visit = (node) => {
    if (found) {
      return;
    }
    const named =
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isVariableDeclaration(node);
    if (named && node.name.getText() === name) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile(root, file));
  if (!found) {
    throw new Error(`${name} is not declared in ${file}.`);
  }
  return found;
}

function memberName(member) {
  if (!member.name) {
    return;
  }
  return ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)
    ? member.name.text
    : member.name.getText();
}

/** Property names of an interface or object type alias (index signatures left out). */
export function interfaceMembers(root, file, name) {
  const declaration = findDeclaration(root, file, name);
  const members = ts.isInterfaceDeclaration(declaration)
    ? declaration.members
    : (declaration.type?.members ?? []);
  return new Set(
    members
      .filter((member) => !ts.isIndexSignatureDeclaration(member))
      .map(memberName)
      .filter(Boolean)
  );
}

/** Keys of an object literal constant (`as const`, `satisfies` allowed). */
function objectKeys(root, file, name) {
  let initializer = findDeclaration(root, file, name).initializer;
  while (
    initializer &&
    (ts.isAsExpression(initializer) ||
      ts.isSatisfiesExpression(initializer) ||
      ts.isParenthesizedExpression(initializer))
  ) {
    initializer = initializer.expression;
  }
  if (!(initializer && ts.isObjectLiteralExpression(initializer))) {
    throw new Error(`${name} in ${file} is not an object literal.`);
  }
  return new Set(initializer.properties.map(memberName).filter(Boolean));
}

/** Every string literal type inside a type alias or interface. */
function stringLiterals(root, file, name) {
  const literals = new Set();
  const visit = (node) => {
    if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) {
      literals.add(node.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(findDeclaration(root, file, name));
  return literals;
}

// What the code declares -------------------------------------------------------------

function sameSet(left, right) {
  return left.size === right.size && [...left].every((item) => right.has(item));
}

function difference(left, right) {
  return [...left].filter((item) => !right.has(item)).sort();
}

function editionSets(root, check) {
  return check.sources.map(([file, name]) => {
    if (check.kind === "objectKeys") {
      return objectKeys(root, file, name);
    }
    if (check.kind === "literals") {
      return stringLiterals(root, file, name);
    }
    return interfaceMembers(root, file, name);
  });
}

function scopeKinds(root) {
  const files = [
    [`${REACT}/utils/scoped-rows.ts`, KIND_FIELD],
    [`${REACT}/utils/filetree-controller.ts`, SCOPE_REFERENCE],
    [`${VUE}/scoped-rows.ts`, KIND_FIELD],
    [`${VUE}/filetree-controller.ts`, SCOPE_REFERENCE],
  ];
  const react = new Set();
  const vue = new Set();
  for (const [file, pattern] of files) {
    const target = file.startsWith(REACT) ? react : vue;
    for (const [, kind] of (readRepoFile(root, file) ?? "").matchAll(pattern)) {
      target.add(kind);
    }
  }
  return [react, vue];
}

function registryItems(root) {
  const react = JSON.parse(
    readRepoFile(root, "registry/registry.json") ?? "{}"
  );
  const vueScript =
    readRepoFile(root, "packages/yayaw-table-vue/scripts/build-registry.mjs") ??
    "";
  return new Set([
    ...(react.items ?? []).map((item) => item.name),
    ...[...vueScript.matchAll(VUE_ITEM_NAME)].map(([, name]) => name),
  ]);
}

/** The set a checked table must list, with the errors of editions that disagree. */
export function declaredSet(root, id) {
  const check = TABLE_CHECKS[id];
  if (check.kind === "registryItems") {
    return { errors: [], values: registryItems(root) };
  }
  const sets =
    check.kind === "scopes" ? scopeKinds(root) : editionSets(root, check);
  const values = new Set(sets.flatMap((set) => [...set]));
  const errors = [];
  if (!check.union && sets.some((set) => !sameSet(set, sets[0]))) {
    errors.push(
      `React and Vue disagree on ${id}: ${sets
        .map((set) => difference(values, set).join(", ") || "complete")
        .join(" / ")} missing. Restore parity before updating the skill.`
    );
  }
  if (values.size === 0) {
    errors.push(`Found nothing to check for ${id}; the extraction is broken.`);
  }
  return { errors, values };
}

// Markdown -----------------------------------------------------------------------------

/** Lines outside fenced code blocks, with their index. */
function proseLines(text) {
  const lines = text.split("\n");
  let fenced = false;
  const result = [];
  for (const [index, line] of lines.entries()) {
    if (FENCE.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (!fenced) {
      result.push({ index, line });
    }
  }
  return result;
}

export function slugify(heading) {
  return heading
    .replace(MARKDOWN_LINK_TEXT, "$1")
    .replace(MARKDOWN_DECORATION, "")
    .trim()
    .toLowerCase()
    .replace(SLUG_REMOVED, "")
    .replaceAll(" ", "-");
}

function headingSlugs(text) {
  const counts = new Map();
  const slugs = new Set();
  for (const { line } of proseLines(text)) {
    const match = line.match(HEADING);
    if (!match) {
      continue;
    }
    const slug = slugify(match[2]);
    const count = counts.get(slug) ?? 0;
    counts.set(slug, count + 1);
    slugs.add(count ? `${slug}-${count}` : slug);
  }
  return slugs;
}

function frontmatterValue(raw) {
  if (raw.startsWith('"')) {
    return JSON.parse(raw);
  }
  if (raw.startsWith("'")) {
    return raw.slice(1, -1).replaceAll("''", "'");
  }
  if (raw.includes(": ") || raw.includes(" #")) {
    throw new Error("quote values that contain ': ' or ' #' (invalid YAML)");
  }
  return raw;
}

export function parseFrontmatter(text) {
  const lines = text.split("\n");
  if (lines[0] !== "---") {
    return { error: "SKILL.md must start with YAML frontmatter (---)." };
  }
  const end = lines.indexOf("---", 1);
  if (end < 0) {
    return { error: "SKILL.md frontmatter is not closed (---)." };
  }
  const fields = {};
  for (const line of lines.slice(1, end)) {
    const match = line.match(FRONTMATTER_ENTRY);
    if (!match) {
      if (line.trim() && !line.startsWith(" ")) {
        return { error: `Unreadable frontmatter line: ${line}` };
      }
      continue;
    }
    try {
      fields[match[1]] = frontmatterValue((match[2] ?? "").trim());
    } catch (error) {
      return { error: `Frontmatter ${match[1]}: ${error.message}` };
    }
  }
  return { bodyLines: lines.length - end - 1, fields };
}

function frontmatterErrors(text, directoryName) {
  const { bodyLines, error, fields } = parseFrontmatter(text);
  if (error) {
    return [error];
  }
  const errors = [];
  const { description, name } = fields;
  for (const key of Object.keys(fields)) {
    if (!FRONTMATTER_KEYS.has(key)) {
      errors.push(`Unknown frontmatter key "${key}".`);
    }
  }
  if (name !== directoryName || !SKILL_NAME_PATTERN.test(name ?? "")) {
    errors.push(
      `Frontmatter name must be "${directoryName}" (lowercase words joined by hyphens).`
    );
  }
  if ((name ?? "").length > MAX_NAME_LENGTH) {
    errors.push(
      `Frontmatter name is longer than ${MAX_NAME_LENGTH} characters.`
    );
  }
  if (!description?.trim()) {
    errors.push("Frontmatter description is missing.");
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(
      `Frontmatter description is ${description.length} characters (at most ${MAX_DESCRIPTION_LENGTH}).`
    );
  } else if (ANGLE_BRACKET.test(description)) {
    errors.push("Frontmatter description must not contain angle brackets.");
  }
  if (bodyLines > MAX_SKILL_LINES) {
    errors.push(
      `SKILL.md body has ${bodyLines} lines; keep it under ${MAX_SKILL_LINES} and move depth to references/.`
    );
  }
  return errors;
}

// Links --------------------------------------------------------------------------------

function anchorError(targetText, anchor, label) {
  if (!anchor) {
    return;
  }
  const slug = decodeURIComponent(anchor);
  return headingSlugs(targetText).has(slug)
    ? undefined
    : `${label}: no heading for #${slug}.`;
}

function relativeLinkError({ file, link, root, skillDir }) {
  const [target, anchor] = link.split("#");
  const absolute = target
    ? path.resolve(path.dirname(file), decodeURIComponent(target))
    : file;
  const label = `${path.relative(root, file)} links to ${link}`;
  if (!absolute.startsWith(`${skillDir}${path.sep}`) && absolute !== skillDir) {
    return `${label}: relative links must stay inside the skill (it is copied on its own); link to GitHub instead.`;
  }
  if (!fs.existsSync(absolute)) {
    return `${label}: the file does not exist.`;
  }
  return absolute.endsWith(".md")
    ? anchorError(fs.readFileSync(absolute, "utf8"), anchor, label)
    : undefined;
}

function githubLinkError({ file, link, root }) {
  const match = link.slice(GITHUB_PREFIX.length).match(GITHUB_FILE);
  if (!match) {
    return;
  }
  const [, kind, target, anchor] = match;
  const absolute = path.join(root, decodeURIComponent(target));
  const label = `${path.relative(root, file)} links to ${link}`;
  if (!fs.existsSync(absolute)) {
    return `${label}: ${target} does not exist in the repository.`;
  }
  if (kind === "blob" && !fs.statSync(absolute).isFile()) {
    return `${label}: ${target} is not a file.`;
  }
  return target.endsWith(".md")
    ? anchorError(fs.readFileSync(absolute, "utf8"), anchor, label)
    : undefined;
}

function linkErrors(context) {
  const prose = proseLines(context.text)
    .map(({ line }) => line.replace(CODE_SPAN, ""))
    .join("\n");
  const errors = [];
  for (const [, link] of prose.matchAll(LINK)) {
    let error;
    if (link.startsWith(GITHUB_PREFIX)) {
      error = githubLinkError({ ...context, link });
    } else if (!(SCHEME.test(link) || link.startsWith("//"))) {
      error = relativeLinkError({ ...context, link });
    }
    if (error) {
      errors.push(error);
    }
  }
  return errors;
}

// Checked tables -----------------------------------------------------------------------

/** Code spans of each first cell of the table that follows a marker line. */
export function tableTokens(lines, markerIndex) {
  const tokens = [];
  let row = 0;
  for (const line of lines.slice(markerIndex + 1)) {
    const trimmed = line.trim();
    if (!trimmed && row === 0) {
      continue;
    }
    if (!trimmed.startsWith("|")) {
      break;
    }
    row += 1;
    if (row <= 2 && (row === 1 || TABLE_SEPARATOR.test(trimmed))) {
      continue;
    }
    const firstCell = trimmed.slice(1).split(TABLE_CELL_SPLIT)[0] ?? "";
    for (const [, token] of firstCell.matchAll(CODE_SPAN)) {
      tokens.push(token);
    }
  }
  return tokens;
}

function markers(files) {
  const found = [];
  for (const { file, text } of files) {
    const lines = text.split("\n");
    for (const [index, line] of lines.entries()) {
      const match = line.trim().match(CHECK_MARKER);
      if (match) {
        found.push({ file, id: match[1], tokens: tableTokens(lines, index) });
      }
    }
  }
  return found;
}

function tableErrors(root, marker) {
  const check = TABLE_CHECKS[marker.id];
  const where = `${path.relative(root, marker.file)} (${marker.id})`;
  if (!check) {
    return [`${where}: unknown skill-check id.`];
  }
  const prefix = check.kind === "members" ? `${marker.id}.` : "";
  const errors = [];
  const listed = new Set();
  for (const token of marker.tokens) {
    if (!token.startsWith(prefix)) {
      errors.push(`${where}: "${token}" should start with "${prefix}".`);
      continue;
    }
    listed.add(token.slice(prefix.length));
  }
  const declared = declaredSet(root, marker.id);
  errors.push(...declared.errors.map((error) => `${where}: ${error}`));
  const unknown = difference(listed, declared.values);
  const missing = difference(declared.values, listed);
  if (unknown.length) {
    errors.push(`${where}: not in the code: ${unknown.join(", ")}.`);
  }
  if (missing.length) {
    errors.push(
      `${where}: declared in the code but not listed: ${missing.join(", ")}.`
    );
  }
  return errors;
}

function markerErrors(root, files) {
  const found = markers(files);
  const errors = found.flatMap((marker) => tableErrors(root, marker));
  for (const id of Object.keys(TABLE_CHECKS)) {
    const count = found.filter((marker) => marker.id === id).length;
    if (count !== 1) {
      errors.push(
        `The skill must have exactly one "<!-- skill-check: ${id} -->" table (found ${count}).`
      );
    }
  }
  return errors;
}

// Free-text references -------------------------------------------------------------------

function actionNamespaces(root) {
  const namespaces = new Map();
  for (const [id, check] of Object.entries(TABLE_CHECKS)) {
    if (check.kind === "members" && id.startsWith("actions.")) {
      namespaces.set(id.slice("actions.".length), declaredSet(root, id).values);
    }
  }
  const top = new Set([
    ...declaredSet(root, "actions").values,
    ...dashboardActions(root),
  ]);
  return { namespaces, top };
}

function dashboardActions(root) {
  const [file, name] = DASHBOARD_PROPS;
  const property = [...findDeclaration(root, file, name).members].find(
    (member) => memberName(member) === "actions"
  );
  const type = property?.type;
  return type && ts.isTypeLiteralNode(type)
    ? type.members.map(memberName).filter(Boolean)
    : [];
}

function actionErrors(label, text, actions) {
  const errors = [];
  for (const [reference, name, member] of text.matchAll(ACTION_REFERENCE)) {
    if (!actions.top.has(name)) {
      errors.push(`${label}: ${reference} is not a table action.`);
      continue;
    }
    const members = actions.namespaces.get(name);
    if (member && !members?.has(member)) {
      errors.push(`${label}: ${reference} is not a member of actions.${name}.`);
    }
  }
  return errors;
}

function importErrors(root, label, text) {
  const errors = [];
  for (const [, , defaultName, named, specifier] of text.matchAll(
    IMPORT_STATEMENT
  )) {
    const source = sourceOfInstalledPath(specifier.slice(2));
    const file = source && resolveModule(root, source);
    if (!file) {
      errors.push(`${label}: cannot resolve "${specifier}".`);
      continue;
    }
    if (defaultName && !file.endsWith(".vue")) {
      errors.push(`${label}: "${specifier}" has no default export to import.`);
    }
    const exported = moduleExports(root, file);
    for (const name of named ? specifierNames(named, "local") : []) {
      if (!exported.has(name)) {
        errors.push(`${label}: "${specifier}" does not export ${name}.`);
      }
    }
  }
  return errors;
}

/** Whether a path-like code span points at something that exists (or is not a path). */
function pathExists(root, span) {
  if (MODULE_REFERENCE.test(span)) {
    const source = sourceOfInstalledPath(span.slice(2));
    return Boolean(source && resolveModule(root, source));
  }
  if (!PATH_REFERENCE.test(span)) {
    return true;
  }
  return span.startsWith("components/ui/")
    ? installedFileExists(root, span.replace(TRAILING_SLASH, ""))
    : fs.existsSync(path.join(root, span));
}

function codeSpanErrors({ label, text, exported, root, scopes }) {
  const errors = [];
  for (const [, span] of text.matchAll(CODE_SPAN)) {
    const helper = span.match(HELPER_REFERENCE);
    if (helper && !exported.has(helper[1])) {
      errors.push(`${label}: ${span} is not exported by either edition.`);
    }
    if (!pathExists(root, span)) {
      errors.push(`${label}: ${span} does not exist.`);
    }
  }
  for (const [reference, kind] of text.matchAll(SCOPE_REFERENCE)) {
    if (!scopes.has(kind)) {
      errors.push(`${label}: ${reference} is not a list scope kind.`);
    }
  }
  return errors;
}

// Entry point ------------------------------------------------------------------------------

/**
 * Every problem found in a skill directory, as messages. `root` is the
 * repository whose code the skill must match.
 */
export function validateSkill({
  root = REPO_ROOT,
  skillDir = path.join(root, "skills", SKILL_NAME),
} = {}) {
  cache.clear();
  const skillFile = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillFile)) {
    return [`${path.relative(root, skillFile)} is missing.`];
  }
  const files = listFiles(skillDir, (file) => file.endsWith(".md")).map(
    (file) => ({ file, text: fs.readFileSync(file, "utf8") })
  );
  const skillText = files.find(({ file }) => file === skillFile)?.text ?? "";
  const errors = frontmatterErrors(skillText, path.basename(skillDir));
  for (const { file } of files) {
    const reference = path.relative(skillDir, file).split(path.sep).join("/");
    if (file !== skillFile && !skillText.includes(`](${reference}`)) {
      errors.push(`SKILL.md does not link to ${reference}.`);
    }
  }
  errors.push(...markerErrors(root, files));
  const context = {
    actions: actionNamespaces(root),
    exported: allExportedNames(root),
    root,
    scopes: declaredSet(root, "scopes").values,
  };
  for (const { file, text } of files) {
    const label = path.relative(root, file);
    errors.push(
      ...linkErrors({ file, root, skillDir, text }),
      ...actionErrors(label, text, context.actions),
      ...importErrors(root, label, text),
      ...codeSpanErrors({ ...context, label, text })
    );
  }
  return [...new Set(errors)];
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = validateSkill();
  if (errors.length) {
    console.error(
      `The yayaw-table skill is out of date (${errors.length}):\n- ${errors.join("\n- ")}`
    );
    process.exit(1);
  }
  console.log("The yayaw-table skill matches the code.");
}
