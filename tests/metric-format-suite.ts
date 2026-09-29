import assert from "node:assert/strict";
import type * as Metric from "../src/components/ui/yayaw-table/utils/metric-format";

type Api = Pick<
  typeof Metric,
  "normalizeMetricFormat" | "metricValueFormatter"
>;
type Test = (name: string, run: () => void) => void;

/** Identical display conversions and validation in both framework editions. */
export function metricFormatSuite(test: Test, api: Api) {
  test("metric formats support decimal, binary and affine conversions without changing inputs", () => {
    const cases: [Metric.MetricDisplayFormat, number, string][] = [
      [
        { scale: 0.000_001, unit: "Mbit/s", decimals: 2 },
        6_250_000,
        "6.25 Mbit/s",
      ],
      [{ scale: 0.001, unit: "s", decimals: 3 }, 1250, "1.250 s"],
      [
        { scale: 1 / 1_048_576, unit: "MiB", decimals: 1 },
        1_572_864,
        "1.5 MiB",
      ],
      [{ scale: 1.8, offset: 32, unit: "°F", decimals: 1 }, -40, "-40.0 °F"],
      [{ scale: 100, unit: "%", decimals: 0 }, 0.25, "25 %"],
      [{ unit: "items", decimals: 0 }, 0, "0 items"],
      [{ unit: "m", decimals: 12 }, 1, "1.000000000000 m"],
    ];
    for (const [format, raw, expected] of cases) {
      const snapshot = { ...format };
      assert.equal(
        api.metricValueFormatter(format, undefined, "en-US")(raw),
        expected
      );
      assert.deepEqual(format, snapshot);
    }
    assert.equal(
      api.metricValueFormatter(
        { scale: 0.000_001, unit: "Mbit/s", decimals: 2 },
        undefined,
        "fr-FR"
      )(6_250_000),
      "6,25 Mbit/s"
    );
  });

  test("format defaults inherit column styles, but literal units replace the source style", () => {
    const currency = { currency: "EUR", decimals: 2 };
    assert.equal(
      api.metricValueFormatter({}, currency, "en-US")(1250),
      "€1,250.00"
    );
    assert.equal(
      api.metricValueFormatter(
        { scale: 0.001, decimals: 1 },
        currency,
        "en-US"
      )(1250),
      "€1.3"
    );
    assert.equal(
      api.metricValueFormatter(
        { scale: 0.001, unit: "kEUR", decimals: 2 },
        currency,
        "en-US"
      )(1250),
      "1.25 kEUR"
    );
    assert.equal(
      api.metricValueFormatter(
        { unit: "%", decimals: 1 },
        { style: "percent" },
        "en-US"
      )(25),
      "25.0 %"
    );
    for (const raw of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.MAX_VALUE,
    ]) {
      assert.equal(
        api.metricValueFormatter({ scale: 2 }, undefined, "en-US")(raw),
        "—"
      );
    }
  });

  test("metric formats reject incomplete or unsafe conversions as a whole", () => {
    for (const invalid of [
      null,
      [],
      "Mbit/s",
      1000,
      { scale: 0 },
      { scale: -1 },
      { scale: "0.001" },
      { scale: Number.POSITIVE_INFINITY },
      { offset: Number.NaN },
      { offset: "32" },
      { decimals: -1 },
      { decimals: 13 },
      { decimals: 1.5 },
      { unit: " " },
      { unit: 123 },
      { unit: "x".repeat(33) },
      { unit: "m\u200bs" },
      { unit: "m\ns" },
      { formula: "value / 1000" },
      { scale: 0.001, typo: true },
    ]) {
      assert.equal(api.normalizeMetricFormat(invalid), undefined);
    }
    assert.deepEqual(
      api.normalizeMetricFormat({
        scale: 0.001,
        offset: -32,
        decimals: 0,
        unit: " ms ",
      }),
      { scale: 0.001, offset: -32, decimals: 0, unit: "ms" }
    );
    assert.deepEqual(api.normalizeMetricFormat({}), {});
  });
}
