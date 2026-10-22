import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  defaultTranslations,
  TableProvider,
} from "../../../providers/table-provider";
import type { FormFieldApi, MultiSelectFieldDefinition } from "../types";
import {
  MultiSelectField,
  normalizeMultiSelectFieldValue,
  toggleMultiSelectFieldValue,
} from "./multi-select-field";
import { SelectField } from "./select-field";

const CAPABILITIES_PATTERN = /Capabilities/;
const NATIVE_TABLES_PATTERN = /Native tables/;
const RUNTIME_API_PATTERN = /Runtime API/;

describe("multi-select field state helpers", () => {
  it("normalizes array values to supported option primitives", () => {
    assert.deepEqual(
      normalizeMultiSelectFieldValue(["native_tables", 1, null, {}]),
      ["native_tables", 1]
    );
  });

  it("appends new choices while preserving stored order", () => {
    const options = [
      { value: "native_tables" },
      { value: "runtime_api" },
      { value: "realtime" },
    ];

    assert.deepEqual(
      toggleMultiSelectFieldValue({
        currentValue: ["runtime_api"],
        optionValue: "native_tables",
        options,
      }),
      ["runtime_api", "native_tables"]
    );
    assert.deepEqual(
      toggleMultiSelectFieldValue({
        currentValue: ["native_tables", "runtime_api"],
        optionValue: "runtime_api",
        options,
      }),
      ["native_tables"]
    );
  });
});

describe("MultiSelectField", () => {
  it("renders checkbox options", () => {
    const field: MultiSelectFieldDefinition<Record<string, unknown>> = {
      label: "Capabilities",
      name: "capabilities",
      options: [
        { label: "Native tables", value: "native_tables" },
        { label: "Runtime API", value: "runtime_api" },
      ],
      type: "multiSelect",
    };
    const fieldApi: FormFieldApi<Array<number | string>> = {
      handleBlur: () => undefined,
      handleChange: () => undefined,
      name: "capabilities",
      state: {
        meta: { errors: [], isValid: true },
        value: ["runtime_api"],
      },
    };

    const html = renderToStaticMarkup(
      <TableProvider
        queryClient={new QueryClient()}
        tableId="multi-select-test"
        translations={defaultTranslations}
      >
        <MultiSelectField field={field} fieldApi={fieldApi} />
      </TableProvider>
    );

    assert.match(html, CAPABILITIES_PATTERN);
    assert.match(html, NATIVE_TABLES_PATTERN);
    assert.match(html, RUNTIME_API_PATTERN);
  });
});

describe("searchable option fields", () => {
  const options = [
    { label: "France", value: 1 },
    { label: "Belgique", value: 2 },
  ];
  const fieldApi = <TValue,>(value: TValue): FormFieldApi<TValue> => ({
    handleBlur: () => undefined,
    handleChange: () => undefined,
    name: "countries",
    state: { meta: { errors: [], isValid: true }, value },
  });
  const render = (node: ReactNode) =>
    renderToStaticMarkup(
      <TableProvider
        queryClient={new QueryClient()}
        tableId="searchable-test"
        translations={defaultTranslations}
      >
        {node}
      </TableProvider>
    );

  it("renders a multiSelect as a combobox with removable chips", () => {
    const html = render(
      <MultiSelectField
        field={{ label: "Countries", name: "countries", options, searchable: true, type: "multiSelect" }}
        fieldApi={fieldApi<Array<number | string>>([2])}
      />
    );
    assert.match(html, /role="combobox"/);
    assert.doesNotMatch(html, /role="checkbox"/);
    assert.match(html, /Belgique/);
    assert.match(html, /aria-label="Remove Belgique"/);
  });

  it("shows the picked option of a single select on its button", () => {
    const html = render(
      <SelectField
        field={{ label: "Country", name: "country", options, searchable: true, type: "select" }}
        fieldApi={fieldApi<string | number | boolean | null>(1)}
      />
    );
    assert.match(html, /role="combobox"[^>]*>.*France/);
    assert.match(html, /aria-label="Remove France"/);
  });
});
