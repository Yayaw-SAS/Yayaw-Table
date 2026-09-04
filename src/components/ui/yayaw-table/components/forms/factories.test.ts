import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import {
  createDateField,
  createMultiSelectField,
  createRadioField,
  createTextField,
} from "./factories";

describe("form field factories", () => {
  it("creates serializable date field definitions", () => {
    const field = createDateField({
      label: "Published at",
      maxDate: "2026-12-31",
      minDate: "2026-01-01",
      name: "publishedAt",
      required: true,
    });

    assert.deepEqual(field, {
      label: "Published at",
      maxDate: "2026-12-31",
      minDate: "2026-01-01",
      name: "publishedAt",
      required: true,
      type: "date",
    });
  });

  it("keeps the legacy date field factory signature", () => {
    const field = createDateField("publishedAt", "Published at", {
      minDate: "2026-01-01",
    });

    assert.deepEqual(field, {
      label: "Published at",
      minDate: "2026-01-01",
      name: "publishedAt",
      type: "date",
    });
  });

  it("creates radio field definitions with options", () => {
    const field = createRadioField({
      label: "Status",
      name: "status",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
    });

    assert.equal(field.type, "radio");
    assert.deepEqual(field.options, [
      { label: "Draft", value: "draft" },
      { label: "Published", value: "published" },
    ]);
  });

  it("creates multi-select field definitions with options", () => {
    const field = createMultiSelectField({
      label: "Capabilities",
      name: "capabilities",
      options: [
        { label: "Native tables", value: "native_tables" },
        { label: "Runtime API", value: "runtime_api" },
      ],
    });

    assert.equal(field.type, "multiSelect");
    assert.deepEqual(field.options, [
      { label: "Native tables", value: "native_tables" },
      { label: "Runtime API", value: "runtime_api" },
    ]);
  });

  it("keeps text input types in field definitions", () => {
    const field = createTextField({
      inputType: "email",
      label: "Contact email",
      name: "email",
    });

    assert.equal(field.inputType, "email");
  });
});
