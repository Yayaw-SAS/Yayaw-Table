import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { QueryClient } from "@tanstack/react-query";
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

  it("toggles option values in option order", () => {
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
      ["native_tables", "runtime_api"]
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
