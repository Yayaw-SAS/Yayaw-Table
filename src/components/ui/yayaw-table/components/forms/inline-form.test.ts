import { expect, it } from "bun:test";
import { z } from "zod";
import { canEditInlineFormField, validateInlineFormValue } from "./inline-form";
import type { FormConfig, FormConfigContext } from "./types";

const context: FormConfigContext = {
  formType: "items",
  tableId: "items",
  tableType: "items",
  mode: "edit",
  values: { name: "Before", locked: false },
};

it("guards conditional and absent catalogue fields before inline edits", async () => {
  const config: FormConfig = {
    id: "items",
    fields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        disabled: ({ values }) => values?.locked === true,
      },
    ],
  };
  expect(canEditInlineFormField(config, config.fields[0], context)).toBe(true);
  expect(canEditInlineFormField(config, undefined, context)).toBe(false);
  expect(
    await validateInlineFormValue(config, "name", "After", {
      ...context,
      values: { ...context.values, locked: true },
    })
  ).toMatchObject({ success: false });
});

it("validates async field schemas and commits their transformed value exactly once", async () => {
  let calls = 0;
  const config: FormConfig = {
    id: "items",
    fields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        required: true,
        schema: z.string().transform(async (value) => {
          calls++;
          return await Promise.resolve(value.trim());
        }),
      },
    ],
    schema: z.object({ name: z.string().min(3) }),
  };
  expect(
    await validateInlineFormValue(config, "name", "  After  ", context)
  ).toEqual({ success: true, committedValue: "After" });
  expect(calls).toBe(1);
  expect(
    await validateInlineFormValue(config, "name", "x", context)
  ).toMatchObject({ success: false });
  expect(
    await validateInlineFormValue(config, "name", "", context)
  ).toMatchObject({ success: false });
});
