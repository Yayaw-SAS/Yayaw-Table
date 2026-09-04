import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import { resolveFormBuilderSections } from "./form-builder";
import type { AnyFieldDefinition } from "./types";

const fields: AnyFieldDefinition<Record<string, unknown>>[] = [
  { label: "Name", name: "name", type: "text" },
  { label: "Status", name: "status", type: "select", options: [] },
  { label: "Notes", name: "notes", type: "textarea" },
];

describe("resolveFormBuilderSections", () => {
  it("falls back to a single default section when no sections are declared", () => {
    const sections = resolveFormBuilderSections({ fields });

    assert.equal(sections.length, 1);
    assert.equal(sections[0]?.isDefault, true);
    assert.deepEqual(
      sections[0]?.fields.map((field) => field.name),
      ["name", "status", "notes"]
    );
  });

  it("groups known fields and keeps ungrouped fields in their original order", () => {
    const sections = resolveFormBuilderSections({
      fields,
      sections: [
        {
          description: "Main entry fields.",
          fields: ["status", "missing"],
          id: "main",
          title: "Main",
        },
      ],
    });

    assert.equal(sections.length, 2);
    assert.equal(sections[0]?.id, "main");
    assert.deepEqual(
      sections[0]?.fields.map((field) => field.name),
      ["status"]
    );
    assert.equal(sections[1]?.isUngrouped, true);
    assert.deepEqual(
      sections[1]?.fields.map((field) => field.name),
      ["name", "notes"]
    );
  });
});
