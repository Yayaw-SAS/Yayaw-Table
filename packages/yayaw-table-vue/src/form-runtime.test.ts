import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  formSubmissionValues,
  initialFormValues,
  resolveFormSections,
  translateFormConfig,
  validateForm,
} from "./form-runtime";
import type { FormConfig, FormFieldContext } from "./types";

const context: FormFieldContext = { mode: "edit", values: {} };

describe("form runtime", () => {
  it("isolates nested defaults and row values, including dates", () => {
    const config: FormConfig = {
      id: "items",
      fields: [
        {
          name: "tags",
          label: "Tags",
          type: "collection",
          defaultValue: [{ label: "Default" }],
        },
      ],
    };
    const date = new Date("2026-01-01T00:00:00Z");
    const row = { settings: { active: true }, date };
    const values = initialFormValues(config, row);
    const firstTag = (values.tags as { label: string }[])[0];
    if (!firstTag) {
      throw new Error("Missing default tag");
    }
    firstTag.label = "Changed";
    (values.settings as { active: boolean }).active = false;
    (values.date as Date).setUTCFullYear(2027);
    expect(config.fields[0]?.defaultValue).toEqual([{ label: "Default" }]);
    expect(row.settings.active).toBe(true);
    expect(date.getUTCFullYear()).toBe(2026);
  });

  it("submits schema-parsed values and awaits async field rules", async () => {
    const config: FormConfig = {
      id: "items",
      fields: [
        {
          name: "name",
          label: "Name",
          type: "text",
          schema: z.string().transform(async (value) => value.trim()),
        },
      ],
      schema: z.object({
        name: z.string().transform((value) => value.toUpperCase()),
      }),
    };
    expect(
      await validateForm(config, { name: " alpha ", ignored: true }, context)
    ).toEqual({ values: { name: "ALPHA" }, errors: {} });
  });

  it("validates nested fields and preserves the complete issue path", async () => {
    const config: FormConfig = {
      id: "items",
      fields: [
        {
          name: "entries",
          label: "Entries",
          type: "collection",
          itemFields: [
            { name: "email", label: "Email", type: "text", schema: z.email() },
          ],
        },
      ],
    };
    const result = await validateForm(
      config,
      { entries: [{ email: "invalid" }] },
      context
    );
    expect(result.errors["entries.0.email"]).toBeTruthy();
  });

  it("does not require hidden or disabled fields or discard false and zero", async () => {
    const config: FormConfig = {
      id: "items",
      fields: [
        {
          name: "secret",
          label: "Secret",
          type: "text",
          required: true,
          hidden: true,
        },
        {
          name: "locked",
          label: "Locked",
          type: "text",
          required: true,
          disabled: true,
        },
        { name: "amount", label: "Amount", type: "number", required: true },
        { name: "active", label: "Active", type: "checkbox", required: true },
      ],
    };
    const result = await validateForm(
      config,
      { amount: 0, active: false, secret: "retained" },
      context
    );
    expect(result.errors).toEqual({});
    expect(formSubmissionValues(config, result.values, {}, context)).toEqual({
      amount: 0,
      active: false,
    });
  });

  it.each([-1, 11])("enforces numeric bounds for value %s", async (amount) => {
    const config: FormConfig = {
      id: "items",
      fields: [
        { name: "amount", label: "Amount", type: "number", min: 0, max: 10 },
      ],
    };
    expect(
      (await validateForm(config, { amount }, context)).errors.amount
    ).toBeTruthy();
  });

  it("creates explicit patches without conflating empty values with unchanged fields", () => {
    const config: FormConfig = {
      id: "items",
      submitMode: "patch",
      fields: ["tags", "amount", "active", "note", "same"].map((name) => ({
        name,
        label: name,
        type: "text",
      })),
    };
    const initial = {
      tags: [1],
      amount: 1,
      active: true,
      note: "old",
      same: { x: 1 },
    };
    const next = {
      tags: [],
      amount: 0,
      active: false,
      note: null,
      same: { x: 1 },
      metadata: "not a field",
    };
    expect(formSubmissionValues(config, next, initial, context)).toEqual({
      tags: [],
      amount: 0,
      active: false,
      note: null,
    });
  });

  it("keeps ungrouped fields and ignores unknown or repeated section references", () => {
    const config: FormConfig = {
      id: "items",
      fields: ["one", "two"].map((name) => ({
        name,
        label: name,
        type: "text",
      })),
      sections: [{ id: "group", fields: ["one", "missing", "one"] }],
    };
    expect(
      resolveFormSections(config).map((section) => section.fields)
    ).toEqual([["one"], ["two"]]);
  });

  it("resolves declared translations recursively without mutating definitions", () => {
    const config: FormConfig = {
      id: "items",
      fields: [{ name: "name", label: "Name", labelKey: "name", type: "text" }],
      sections: [{ id: "group", fields: ["name"], titleKey: "group" }],
      translations: {
        namespace: "items",
        keys: { name: "Display name", group: "Details" },
      },
    };
    const translated = translateFormConfig(config);
    expect(translated.fields[0]?.label).toBe("Display name");
    expect(translated.sections?.[0]?.title).toBe("Details");
    expect(config.fields[0]?.label).toBe("Name");
  });
});
