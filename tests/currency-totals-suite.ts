import assert from "node:assert/strict";
import type * as ValueFormat from "../src/components/ui/yayaw-table/utils/value-format";

type Formats = Pick<
  typeof ValueFormat,
  | "calculateCurrencyColumn"
  | "currencyAmountsResult"
  | "formatColumnNumber"
  | "rowCurrency"
>;

const ROWS = [
  { amount: 1000, currency: "EUR" },
  { amount: 200, currency: "eur" },
  { amount: 300, currency: "USD" },
  { amount: null, currency: "USD" },
  { amount: 50, currency: "" },
];
const VALUES = ROWS.map((row) => row.amount);
const PER_ROW = {
  type: "number",
  numberFormat: { currency: "EUR", currencyColumn: "currency" },
};

export function currencyTotalsSuite(
  test: (name: string, run: () => void) => void,
  formats: Formats
) {
  test("cells read in their row's currency, the column's as a fallback", () => {
    assert.equal(formats.rowCurrency(PER_ROW.numberFormat, ROWS[2]), "USD");
    assert.equal(formats.rowCurrency(PER_ROW.numberFormat, ROWS[4]), "EUR");
    assert.equal(formats.rowCurrency("locale", ROWS[2]), undefined);
    assert.equal(
      formats.formatColumnNumber(300, PER_ROW, "en-US", ROWS[2]),
      "$300.00"
    );
    assert.equal(formats.formatColumnNumber(300, PER_ROW, "en-US"), "€300.00");
  });

  test("sums stay per currency and never mix", () => {
    const result = formats.calculateCurrencyColumn(
      VALUES,
      ROWS,
      "sum",
      PER_ROW,
      "en-US"
    );
    assert.deepEqual(result?.byCurrency, { EUR: 1250, USD: 300 });
    assert.equal(result?.raw, null);
    assert.equal(result?.label, "€1,250.00 · $300.00");
    const average = formats.calculateCurrencyColumn(
      VALUES,
      ROWS,
      "average",
      PER_ROW,
      "en-US"
    );
    assert.deepEqual(average?.byCurrency, { EUR: 1250 / 3, USD: 300 });
    assert.equal(
      formats.calculateCurrencyColumn(VALUES, ROWS, "count_all", PER_ROW),
      undefined
    );
    assert.equal(
      formats.calculateCurrencyColumn(VALUES, ROWS, "sum", {
        type: "number",
        numberFormat: { currency: "EUR" },
      }),
      undefined
    );
  });

  test("one currency reads as a plain total; rows without one stay apart", () => {
    const single = formats.calculateCurrencyColumn(
      [10, 20],
      [{ currency: "USD" }, { currency: "usd" }],
      "sum",
      { type: "number", numberFormat: { currencyColumn: "currency" } },
      "en-US"
    );
    assert.equal(single?.raw, 30);
    assert.equal(single?.label, "$30.00");
    const unknown = formats.calculateCurrencyColumn(
      [10, 5],
      [{ currency: "USD" }, { currency: "dollars" }],
      "sum",
      { type: "number", numberFormat: { currencyColumn: "currency" } },
      "en-US"
    );
    assert.equal(unknown?.label, "$10.00 · 5");
  });

  test("a rates map or a host callback converts into one total", () => {
    const converted = formats.calculateCurrencyColumn(
      VALUES,
      ROWS,
      "sum",
      {
        type: "number",
        numberFormat: {
          currencyColumn: "currency",
          currency: "EUR",
          currencyConversion: { currency: "eur", rates: { USD: 0.5 } },
        },
      },
      "en-US"
    );
    assert.equal(converted?.raw, 1400);
    assert.deepEqual(converted?.converted, { currency: "EUR", value: 1400 });
    assert.equal(converted?.label, "€1,400.00");
    const both = formats.calculateCurrencyColumn(
      VALUES,
      ROWS,
      "max",
      {
        type: "number",
        numberFormat: {
          currencyColumn: "currency",
          currency: "EUR",
          currencyConversion: {
            currency: "USD",
            convert: (amount, from) =>
              from === "EUR" ? amount * 2 : undefined,
            display: "both",
          },
        },
      },
      "en-US"
    );
    assert.equal(both?.raw, 2000);
    assert.equal(both?.label, "$2,000.00 (€1,000.00 · $300.00)");
    const missing = formats.calculateCurrencyColumn(
      VALUES,
      ROWS,
      "sum",
      {
        type: "number",
        numberFormat: {
          currencyColumn: "currency",
          currency: "EUR",
          currencyConversion: { currency: "GBP", rates: { EUR: 0.8 } },
        },
      },
      "en-US"
    );
    assert.equal(missing?.converted, undefined);
    assert.equal(missing?.label, "€1,250.00 · $300.00");
  });

  test("a host's per-currency amounts are formatted, sums converted", () => {
    const column = {
      type: "number",
      numberFormat: {
        currencyColumn: "currency",
        currencyConversion: { currency: "EUR", rates: { USD: 0.5 } },
      },
    };
    const sum = formats.currencyAmountsResult(
      { usd: 300, EUR: 1200 },
      "sum",
      column,
      "en-US"
    );
    assert.deepEqual(sum.byCurrency, { USD: 300, EUR: 1200 });
    assert.equal(sum.label, "€1,350.00");
    const average = formats.currencyAmountsResult(
      { USD: 300, EUR: 1200 },
      "average",
      column,
      "en-US"
    );
    assert.equal(average.raw, null);
    assert.equal(average.label, "€1,200.00 · $300.00");
  });
}
