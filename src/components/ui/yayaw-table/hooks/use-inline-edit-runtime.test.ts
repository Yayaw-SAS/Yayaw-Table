import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import {
  parseInlineEditValue,
  resolveInlineEditColumnConfig,
  resolveInlineEditor,
  validateInlineEditValue,
} from "./use-inline-edit-runtime";

describe("resolveInlineEditColumnConfig", () => {
  it("enables inline edit when column explicitly opts in", () => {
    const result = resolveInlineEditColumnConfig(
      {
        id: "name",
        type: "text",
        inlineEdit: true,
      },
      {
        enabled: false,
      }
    );

    assert.equal(result.enabled, true);
    assert.equal(result.debounceMs, 700);
    assert.equal(result.formField, "name");
  });

  it("uses table defaults and blocks readonly columns", () => {
    const result = resolveInlineEditColumnConfig(
      {
        id: "price",
        type: "number",
        inlineEdit: {
          debounceMs: 150,
          readonly: true,
        },
      },
      {
        enabled: true,
        debounceMs: 900,
        optimistic: false,
        showDelayIndicator: false,
      }
    );

    assert.equal(result.enabled, false);
    assert.equal(result.debounceMs, 150);
    assert.equal(result.optimistic, false);
    assert.equal(result.showDelayIndicator, false);
  });

  it("never enables system columns", () => {
    const result = resolveInlineEditColumnConfig(
      {
        id: "actions",
        type: "actions",
        inlineEdit: true,
      },
      {
        enabled: true,
      }
    );

    assert.equal(result.enabled, false);
  });

  it("disables inline edit when feature gate is off", () => {
    const result = resolveInlineEditColumnConfig(
      {
        id: "name",
        type: "text",
        inlineEdit: true,
      },
      {
        enabled: true,
      },
      {
        featureEnabled: false,
      }
    );

    assert.equal(result.enabled, false);
  });
});

describe("resolveInlineEditor", () => {
  it("prioritizes explicit editor when provided", () => {
    const editor = resolveInlineEditor({
      explicitEditor: "json",
      columnType: "text",
      formFieldType: "text",
      hasOptions: true,
    });

    assert.equal(editor, "json");
  });

  it("maps form field types before column type", () => {
    const editor = resolveInlineEditor({
      columnType: "text",
      formFieldType: "number",
    });

    assert.equal(editor, "number");
  });

  it("falls back to select when options are available", () => {
    const editor = resolveInlineEditor({
      columnType: "dynamicType",
      hasOptions: true,
    });

    assert.equal(editor, "select");
  });

  it("maps multiSelect columns to multiSelect editor", () => {
    const editor = resolveInlineEditor({
      columnType: "multiSelect",
      hasOptions: true,
    });

    assert.equal(editor, "multiSelect");
  });
});

describe("parseInlineEditValue", () => {
  it("parses numeric strings into numbers", () => {
    const result = parseInlineEditValue({
      editor: "number",
      rawValue: "42.5",
    });

    assert.equal(result.success, true);
    assert.equal(result.value, 42.5);
  });

  it("rejects invalid numbers", () => {
    const result = parseInlineEditValue({
      editor: "number",
      rawValue: "abc",
    });

    assert.equal(result.success, false);
    assert.equal(result.errorMessage, "Inline edit expects a valid number.");
  });

  it("parses ISO date input format", () => {
    const result = parseInlineEditValue({
      editor: "date",
      rawValue: "2026-02-17",
    });

    assert.equal(result.success, true);
    assert.ok(result.value instanceof Date);
  });

  it("keeps select option value types", () => {
    const result = parseInlineEditValue({
      editor: "select",
      rawValue: "true",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    });

    assert.equal(result.success, true);
    assert.equal(result.value, true);
  });

  it("keeps multiSelect option value types", () => {
    const result = parseInlineEditValue({
      editor: "multiSelect",
      rawValue: ["true", "2", "custom"],
      options: [
        { label: "Yes", value: true },
        { label: "Two", value: 2 },
      ],
    });

    assert.equal(result.success, true);
    assert.deepEqual(result.value, [true, 2, "custom"]);
  });

  it("rejects invalid json payloads", () => {
    const result = parseInlineEditValue({
      editor: "json",
      rawValue: "{ invalid json }",
    });

    assert.equal(result.success, false);
    assert.equal(result.errorMessage, "Inline edit expects valid JSON.");
  });
});

describe("validateInlineEditValue", () => {
  it("rejects invalid fallback number values", () => {
    const result = validateInlineEditValue({
      editor: "number",
      candidateValue: Number.NaN,
      formField: "price",
      rowData: {},
    });

    assert.equal(result.success, false);
    assert.equal(result.errorMessage, "Inline edit expects a valid number.");
  });

  it("uses schema message when safeParse fails", () => {
    const result = validateInlineEditValue({
      editor: "text",
      candidateValue: "",
      formField: "name",
      rowData: {
        id: "1",
      },
      schema: {
        safeParse: () => ({
          success: false as const,
          error: {
            issues: [
              {
                path: ["name"],
                message: "Name is required",
              },
            ],
          },
        }),
      },
    });

    assert.equal(result.success, false);
    assert.equal(result.errorMessage, "Name is required");
  });

  it("passes when schema validation succeeds", () => {
    const result = validateInlineEditValue({
      editor: "text",
      candidateValue: "Laptop",
      formField: "name",
      rowData: {
        id: "1",
      },
      schema: {
        safeParse: () => ({
          success: true as const,
        }),
      },
    });

    assert.equal(result.success, true);
  });

  it("rejects invalid multiSelect payloads", () => {
    const result = validateInlineEditValue({
      editor: "multiSelect",
      candidateValue: "single",
      formField: "tags",
      rowData: {},
    });

    assert.equal(result.success, false);
    assert.equal(
      result.errorMessage,
      "Inline edit expects an array of values."
    );
  });
});
