import { expect, it } from "vitest";
import scenarios from "../../../tests/fixtures/form-scenarios.json";
import {
  bulkCompletion,
  bulkFormConfig,
  bulkFormValues,
  commonBulkValues,
} from "./bulk-form";
import {
  formSubmissionValues,
  initialFormValues,
  validateForm,
} from "./form-runtime";
import type { FormConfig, FormFieldContext } from "./types";

const config = scenarios.config as FormConfig;
const context: FormFieldContext = {
  mode: "edit",
  formType: "product",
  tableId: "products",
  tableType: "products",
  values: {},
};

for (const scenario of scenarios.payloads) {
  it(`shared form contract: ${scenario.label}`, async () => {
    const current = { ...context, values: scenario.values };
    const result = await validateForm(config, scenario.values, current);
    expect(result.errors).toEqual({});
    expect(
      formSubmissionValues(config, result.values, scenario.initial, current)
    ).toEqual(scenario.expected);
  });
}
it("shared form contract: nested errors retain their complete paths", async () => {
  const result = await validateForm(config, scenarios.invalid.values, {
    ...context,
    values: scenarios.invalid.values,
  });
  expect(Object.keys(result.errors).sort()).toEqual(scenarios.invalid.paths);
});
it("shared form contract: defaults and bulk patches preserve only intended fields", () => {
  expect(initialFormValues(config, {})).toMatchObject({
    active: false,
    amount: 0,
  });
  expect(commonBulkValues(scenarios.bulkRows)).toEqual(scenarios.common);
  const current = {
    ...context,
    values: { active: false, amount: 99 },
    bulkEdit: {
      rows: scenarios.bulkRows,
      ids: ["1", "2"],
      fields: ["active", "secret", "locked"],
    },
  };
  expect(
    bulkFormValues(bulkFormConfig(config, current), current.values)
  ).toEqual({ active: false });
});
for (const scenario of scenarios.completions) {
  it(`shared bulk completion: ${JSON.stringify(scenario.result)}`, () => {
    expect(bulkCompletion(["1", "2"], scenario.result)).toEqual(
      scenario.expected
    );
  });
}
