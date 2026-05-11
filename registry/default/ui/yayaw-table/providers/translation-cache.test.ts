import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultTranslations } from "./table-provider";
import {
  createTranslationFunction,
  resolveTranslationsToUiStrings,
} from "./translation-cache";

describe("resolveTranslationsToUiStrings", () => {
  it("resolves every footer calculation key from DataTableTranslations", () => {
    const resolved = resolveTranslationsToUiStrings(defaultTranslations);

    assert.equal(resolved.calcNone, defaultTranslations.calculations.none);
    assert.equal(resolved.calcCount, defaultTranslations.calculations.count);
    assert.equal(
      resolved.calcPercent,
      defaultTranslations.calculations.percent
    );
    assert.equal(resolved.calcMore, defaultTranslations.calculations.more);
    assert.equal(
      resolved.calcCountAll,
      defaultTranslations.calculations.count_all
    );
    assert.equal(
      resolved.calcCountValues,
      defaultTranslations.calculations.count_values
    );
    assert.equal(
      resolved.calcCountUnique,
      defaultTranslations.calculations.count_unique
    );
    assert.equal(
      resolved.calcCountEmpty,
      defaultTranslations.calculations.count_empty
    );
    assert.equal(
      resolved.calcCountNotEmpty,
      defaultTranslations.calculations.count_not_empty
    );
    assert.equal(
      resolved.calcCountTrue,
      defaultTranslations.calculations.count_true
    );
    assert.equal(
      resolved.calcCountFalse,
      defaultTranslations.calculations.count_false
    );
    assert.equal(
      resolved.calcPercentEmpty,
      defaultTranslations.calculations.percent_empty
    );
    assert.equal(
      resolved.calcPercentNotEmpty,
      defaultTranslations.calculations.percent_not_empty
    );
    assert.equal(
      resolved.calcPercentTrue,
      defaultTranslations.calculations.percent_true
    );
    assert.equal(
      resolved.calcPercentFalse,
      defaultTranslations.calculations.percent_false
    );
    assert.equal(resolved.calcSum, defaultTranslations.calculations.sum);
    assert.equal(
      resolved.calcAverage,
      defaultTranslations.calculations.average
    );
    assert.equal(resolved.calcMedian, defaultTranslations.calculations.median);
    assert.equal(resolved.calcMin, defaultTranslations.calculations.min);
    assert.equal(resolved.calcMax, defaultTranslations.calculations.max);
    assert.equal(resolved.calcRange, defaultTranslations.calculations.range);
    assert.equal(
      resolved.calcCalculate,
      defaultTranslations.calculations.calculate
    );
  });

  it("does not return technical key paths for footer calculation labels", () => {
    const frLikeTranslations = {
      ...defaultTranslations,
      calculations: {
        ...defaultTranslations.calculations,
        sum: "Somme",
        average: "Moyenne",
        calculate: "Calculer",
      },
    };

    const resolved = resolveTranslationsToUiStrings(frLikeTranslations);

    assert.equal(resolved.calcSum, "Somme");
    assert.equal(resolved.calcAverage, "Moyenne");
    assert.equal(resolved.calcCalculate, "Calculer");
    assert.notEqual(resolved.calcSum, "calculations.sum");
    assert.notEqual(resolved.calcCalculate, "calculations.calculate");
  });
});

describe("createTranslationFunction", () => {
  it("resolves menu footer toggle labels", () => {
    const t = createTranslationFunction(defaultTranslations);

    assert.equal(t("menu.footer_calculations"), "Footer calculations");
    assert.equal(t("menu.footer_calculations_on"), "On");
    assert.equal(t("menu.footer_calculations_off"), "Off");
  });

  it("resolves backward-compatible action labels", () => {
    const t = createTranslationFunction(defaultTranslations);

    assert.equal(t("actions.close"), "Close");
    assert.equal(t("actions.create"), "Create");
    assert.equal(t("filter_types.option"), "Option");
    assert.equal(t("filter_types.multiOption"), "Multiple options");
    assert.equal(t("form"), "Form");
    assert.equal(t("value"), "Value");
  });
});
