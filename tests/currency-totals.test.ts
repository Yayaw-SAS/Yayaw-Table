import { test } from "bun:test";
import assert from "node:assert/strict";
import { loadGlobalColumnCalculationResults } from "../src/components/ui/yayaw-table/hooks/use-global-column-calculations";
import {
  calculateCurrencyColumn,
  currencyAmountsResult,
  formatColumnNumber,
  rowCurrency,
} from "../src/components/ui/yayaw-table/utils/value-format";
import { currencyTotalsSuite } from "./currency-totals-suite";

currencyTotalsSuite(test, {
  calculateCurrencyColumn,
  currencyAmountsResult,
  formatColumnNumber,
  rowCurrency,
});

const AMOUNT_COLUMN = {
  id: "amount",
  type: "number",
  numberFormat: { currencyColumn: "currency" },
};
const BASE = {
  advancedFiltersParam: [],
  calculations: { amount: "sum" as const },
  columns: { amount: AMOUNT_COLUMN },
  columnTypes: { amount: "number" },
  filtersParam: [],
  globalSearchParam: "",
  locale: "en-US",
  pageSizeParam: "",
  sortParam: [],
};

test("React footer sums from the rows stay per currency", async () => {
  const results = await loadGlobalColumnCalculationResults({
    ...BASE,
    actions: {
      list: async () => ({
        data: [
          { id: 1, amount: 1200, currency: "EUR" },
          { id: 2, amount: 300, currency: "USD" },
        ],
        meta: { pageCount: 1, totalCount: 2 },
      }),
    } as never,
  });
  assert.equal(results.amount?.label, "€1,200.00 · $300.00");
});

test("React footer asks the host per currency and formats its answer", async () => {
  let asked: unknown;
  const results = await loadGlobalColumnCalculationResults({
    ...BASE,
    actions: {
      aggregate: (params: { currencyColumns?: unknown }) => {
        asked = params.currencyColumns;
        return Promise.resolve({
          results: {
            amount: { raw: null, byCurrency: { EUR: 1200, USD: 300 } },
          },
        });
      },
    } as never,
  });
  assert.deepEqual(asked, { amount: "currency" });
  assert.equal(results.amount?.label, "€1,200.00 · $300.00");
});
