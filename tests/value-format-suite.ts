import assert from "node:assert/strict";
import type * as Format from "../src/components/ui/yayaw-table/utils/value-format";

type FormatModule = Pick<
  typeof Format,
  | "formatDateValue"
  | "formatNumberValue"
  | "isBlankCardValue"
  | "numberBarRatio"
>;

const DATE_TIME = /^Sep 5, 2026(,| at) 2:30 PM$/;

// Intl may use narrow no-break spaces; compare with plain spaces.
const plain = (text: string) => text.replace(/[  ]/g, " ");

export function valueFormatSuite(
  test: (name: string, run: () => void) => void,
  format: FormatModule
) {
  test("card properties with nothing to show are blank", () => {
    for (const blank of [null, undefined, "", "  ", []]) {
      assert.equal(format.isBlankCardValue(blank), true);
    }
    // False, zero and text are values: booleans show an unchecked mark.
    for (const value of [false, 0, "x", ["a"], new Date(0)]) {
      assert.equal(format.isBlankCardValue(value), false);
    }
  });

  const number = (value: unknown, config?: Format.NumberFormatConfig) =>
    plain(format.formatNumberValue(value, config, "en-US"));

  test("keeps the historical grouping presets", () => {
    assert.equal(number(1_234_567.891, "space"), "1 234 567.89");
    assert.equal(number(1_234_567.891, "dot"), "1.234.567,89");
    assert.equal(number(1_234_567.891, "comma"), "1,234,567.89");
  });

  test("formats currencies, percents, compact numbers and units by locale", () => {
    assert.equal(number(1234.5, { currency: "EUR" }), "€1,234.50");
    assert.equal(
      number(1234.5, { currency: "EUR", locale: "fr-FR" }),
      "1 234,50 €"
    );
    assert.equal(
      number(1234.5, { currency: "USD", currencyDisplay: "code" }),
      "USD 1,234.50"
    );
    assert.equal(number(0.256, { style: "percent", decimals: 1 }), "25.6%");
    assert.equal(number(25, { style: "percent", percentBase: "whole" }), "25%");
    assert.equal(number(1_250_000, { style: "compact" }), "1.3M");
    assert.equal(number(12, { style: "unit", unit: "kilogram" }), "12 kg");
  });

  test("applies separators, affixes, signs and accounting negatives", () => {
    assert.equal(
      number(1234.5, {
        thousandsSeparator: " ",
        decimalSeparator: ",",
        decimals: 2,
      }),
      "1 234,50"
    );
    assert.equal(number(1234.5, { thousandsSeparator: "none" }), "1234.5");
    assert.equal(number(42, { prefix: "~", suffix: " pts" }), "~42 pts");
    assert.equal(number(5, { signDisplay: "always" }), "+5");
    assert.equal(
      number(-1234.5, { currency: "USD", negative: "parentheses" }),
      "($1,234.50)"
    );
    assert.equal(number("12.5", { decimalPlaces: 0 }), "13");
    assert.equal(number(null), "—");
    assert.equal(number("n/a"), "n/a");
  });

  test("fills progress bars against a maximum", () => {
    assert.equal(format.numberBarRatio(50, { display: "bar" }), 0.5);
    assert.equal(
      format.numberBarRatio(0.4, { display: "bar", style: "percent" }),
      0.4
    );
    assert.equal(format.numberBarRatio(150, { display: "bar", max: 100 }), 1);
    assert.equal(format.numberBarRatio(50, { style: "decimal" }), undefined);
  });

  const date = (value: unknown, options: Format.ColumnDateFormat) =>
    plain(
      format.formatDateValue(value, {
        locale: "en-US",
        timeZone: "UTC",
        ...options,
      })
    );
  const instant = "2026-09-05T14:30:00Z";

  test("formats every date preset", () => {
    assert.equal(date(instant, { preset: "localized-short" }), "9/5/26");
    assert.equal(date(instant, { preset: "localized-medium" }), "Sep 5, 2026");
    assert.equal(
      date(instant, { preset: "localized-long" }),
      "September 5, 2026"
    );
    assert.equal(date(instant, { preset: "month-year" }), "September 2026");
    assert.equal(date(instant, { preset: "dmy-numeric" }), "05/09/2026");
    assert.equal(date(instant, { preset: "mdy-short" }), "09/05/26");
    assert.equal(date(instant, { preset: "iso-date" }), "2026-09-05");
    assert.equal(date(instant, { preset: "iso" }), "2026-09-05T14:30:00.000Z");
    assert.equal(date(instant, { preset: "time" }), "2:30 PM");
    assert.equal(date(instant, { preset: "time", hour12: false }), "14:30");
    // ICU versions join date and time with ", " or " at ".
    assert.match(date(instant, { preset: "dateTime" }), DATE_TIME);
  });

  test("uses the requested time zone and a localized relative time", () => {
    assert.equal(
      date(instant, { preset: "time", timeZone: "Asia/Tokyo", hour12: false }),
      "23:30"
    );
    assert.equal(
      date(instant, { preset: "iso-date", timeZone: "Pacific/Auckland" }),
      "2026-09-06"
    );
    const now = new Date("2026-09-08T14:30:00Z");
    assert.equal(date(instant, { preset: "relative", now }), "3 days ago");
    assert.equal(
      date(instant, { preset: "relative", now, locale: "fr-FR" }),
      "il y a 3 jours"
    );
  });

  test("reads date-only values as local calendar days", () => {
    assert.equal(
      plain(format.formatDateValue("2026-09-05", { preset: "iso-date" })),
      "2026-09-05"
    );
    assert.equal(
      plain(format.formatDateValue("2026/09/05", { preset: "iso-date" })),
      "2026-09-05"
    );
    assert.equal(format.formatDateValue("", {}), "—");
    assert.equal(format.formatDateValue("soon", {}), "soon");
  });
}
