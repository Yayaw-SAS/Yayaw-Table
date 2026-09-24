import { afterEach, expect, test } from "bun:test";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { slugify, validateSkill } from "../scripts/validate-skill.mjs";

const ROOT = resolve(import.meta.dir, "..");
const SKILL = join(ROOT, "skills", "yayaw-table");
const GANTT_ROW = /^\| `gantt` \|.*\n/m;
const TABLE_ROW = /^(\| `table` \|.*\n)/m;
const copies: string[] = [];

afterEach(() => {
  for (const copy of copies.splice(0)) {
    rmSync(copy, { force: true, recursive: true });
  }
});

/** A copy of the skill with one file edited, validated against this repository. */
function validateEdited(
  file: string,
  edit: (text: string) => string
): string[] {
  const parent = mkdtempSync(join(tmpdir(), "yayaw-skill-"));
  copies.push(parent);
  const skillDir = join(parent, "yayaw-table");
  cpSync(SKILL, skillDir, { recursive: true });
  const path = join(skillDir, file);
  const text = readFileSync(path, "utf8");
  const edited = edit(text);
  if (edited === text) {
    throw new Error(`The edit left ${file} unchanged.`);
  }
  writeFileSync(path, edited);
  return validateSkill({ root: ROOT, skillDir });
}

const appendTo = (addition: string) => (text: string) =>
  `${text}\n${addition}\n`;

test("the skill matches the code", () => {
  expect(validateSkill({ root: ROOT })).toEqual([]);
});

test("frontmatter needs the directory name and a description", () => {
  const errors = validateEdited("SKILL.md", (text) =>
    text.replace("name: yayaw-table", "name: yayaw")
  );
  expect(errors.some((error) => error.includes("Frontmatter name"))).toBe(true);
});

test("the display mode table must list exactly the registry's modes", () => {
  const missing = validateEdited("SKILL.md", (text) =>
    text.replace(GANTT_ROW, "")
  );
  expect(missing.join("\n")).toContain("not listed: gantt");

  const unknown = validateEdited("SKILL.md", (text) =>
    text.replace(TABLE_ROW, "$1| `timeline` | Planned work | dates | core |\n")
  );
  expect(unknown.join("\n")).toContain("not in the code: timeline");
});

test("links must resolve inside the skill", () => {
  const broken = validateEdited(
    "SKILL.md",
    appendTo("[missing](references/missing.md)")
  );
  expect(broken.join("\n")).toContain("the file does not exist");

  const outside = validateEdited(
    "references/install.md",
    appendTo("[Gantt](../../../docs/GANTT.md)")
  );
  expect(outside.join("\n")).toContain("must stay inside the skill");

  const anchor = validateEdited(
    "SKILL.md",
    appendTo("[nowhere](references/install.md#no-such-heading)")
  );
  expect(anchor.join("\n")).toContain("no heading for #no-such-heading");
});

test("actions, scopes, helpers, imports and paths must exist", () => {
  const errors = validateEdited(
    "references/testing.md",
    appendTo(
      [
        "`actions.fetchRows` and `actions.tree.rename`",
        '`scope: { kind: "radius" }`',
        "`makeTable()`",
        "`components/ui/yayaw-table/utils/nope.ts`",
        "```ts",
        'import { Nope } from "@/components/ui/yayaw-table";',
        "```",
      ].join("\n")
    )
  ).join("\n");
  expect(errors).toContain("actions.fetchRows is not a table action");
  expect(errors).toContain("actions.tree.rename is not a member");
  expect(errors).toContain('kind: "radius" is not a list scope kind');
  expect(errors).toContain("makeTable() is not exported");
  expect(errors).toContain("utils/nope.ts does not exist");
  expect(errors).toContain("does not export Nope");
});

test("headings become GitHub anchors", () => {
  expect(slugify("Destinations, connectors and schedules")).toBe(
    "destinations-connectors-and-schedules"
  );
  expect(slugify("`list`")).toBe("list");
  expect(slugify("React and Vue differences")).toBe(
    "react-and-vue-differences"
  );
});
