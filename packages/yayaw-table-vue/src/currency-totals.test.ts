import assert from "node:assert/strict";
import { it } from "vitest";
import { currencyTotalsSuite } from "../../../tests/currency-totals-suite";
import { calculateColumn, displayCellValue } from "./core";
import {
  calculateCurrencyColumn,
  currencyAmountsResult,
  formatColumnNumber,
  rowCurrency,
} from "./value-format";

currencyTotalsSuite(it, {
  calculateCurrencyColumn,
  currencyAmountsResult,
  formatColumnNumber,
  rowCurrency,
});

const AMOUNT = {
  id: "amount",
  header: "Amount",
  type: "number" as const,
  numberFormat: { currencyColumn: "currency" },
};
const ROWS = [
  { id: 1, amount: 1200, currency: "EUR" },
  { id: 2, amount: 300, currency: "USD" },
];

it("Vue footer sums stay per currency and cells read their row's currency", () => {
  assert.equal(
    calculateColumn(ROWS, "amount", "sum", "number", "en-US", AMOUNT),
    "€1,200.00 · $300.00"
  );
  assert.equal(calculateColumn(ROWS, "amount", "count_all", "number"), 2);
  assert.equal(displayCellValue(300, AMOUNT, "en-US", ROWS[1]), "$300.00");
});
