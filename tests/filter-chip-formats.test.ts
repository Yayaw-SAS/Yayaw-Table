import { expect, test } from "bun:test";
import { formatFilterValueForDisplay } from "../src/components/ui/yayaw-table/utils/advanced-filters";

// Intl may use narrow and no-break spaces; compare with plain spaces.
const plain = (text: string) => text.replace(/[  ]/g, " ");
const EUR = { style: "currency" as const, currency: "EUR" };

test("filter chips show numbers in the column's format, zero included", () => {
  expect(
    plain(
      formatFilterValueForDisplay("number", "greaterThan", 2499, undefined, {
        numberFormat: EUR,
        locale: "fr-FR",
      })
    )
  ).toBe("2 499,00 €");
  expect(
    formatFilterValueForDisplay("number", "between", [0, 1000], undefined, {
      numberFormat: EUR,
      locale: "en-US",
    })
  ).toBe("€0.00 - €1,000.00");
  expect(
    formatFilterValueForDisplay("number", "equals", 0, undefined, {})
  ).toBe("0");
  expect(
    formatFilterValueForDisplay("number", "isEmpty", undefined, undefined, {})
  ).toBe("");
});

test("filter dates are days in the date part of the column's format", () => {
  expect(
    formatFilterValueForDisplay("date", "equals", "2026-09-06", undefined, {
      dateFormat: "dd/MM/yyyy HH:mm",
      locale: "en-US",
    })
  ).toBe("06/09/2026");
  expect(
    formatFilterValueForDisplay(
      "date",
      "between",
      [new Date(2026, 8, 30), new Date(2026, 8, 1)],
      undefined,
      { dateFormat: "dd/MM/yyyy HH:mm" }
    )
  ).toBe("01/09/2026 - 30/09/2026");
  expect(
    formatFilterValueForDisplay("date", "equals", "2026-09-06", undefined, {
      dateDisplayPreset: "dateTime",
      locale: "en-US",
    })
  ).toBe("Sep 6, 2026");
  expect(
    formatFilterValueForDisplay("date", "equals", "2026-09-06", undefined, {
      fallbackDateDisplayPreset: "iso-date",
    })
  ).toBe("2026-09-06");
});
