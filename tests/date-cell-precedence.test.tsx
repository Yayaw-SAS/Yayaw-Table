import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTypeCell } from "../src/components/ui/yayaw-table/components/cells/data-type-cell";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";
import { formatDateForDisplay } from "../src/components/ui/yayaw-table/utils/date-display";

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});

// Intl may use narrow and no-break spaces; compare with plain spaces.
const plain = (text: string | null | undefined) =>
  (text ?? "").replace(/[  ]/g, " ");

const INSTANT = "2026-09-05T22:30:00Z";
const PARIS = "Europe/Paris";

it("a column's pattern and time zone win over the table's date preset", () => {
  expect(
    formatDateForDisplay(INSTANT, {
      dateFormat: "dd/MM/yyyy HH:mm",
      timeZone: PARIS,
      fallbackDateDisplayPreset: "localized-short",
      locale: "en-US",
    })
  ).toBe("06/09/2026 00:30");
  // Over the column's own preset too, as in Vue and the shared formatter.
  expect(
    formatDateForDisplay(INSTANT, {
      dateFormat: "dd/MM/yyyy HH:mm",
      dateDisplayPreset: "localized-long",
      timeZone: PARIS,
      locale: "fr-FR",
    })
  ).toBe("06/09/2026 00:30");
  // Presets read the column's zone; calendar days never shift.
  expect(
    formatDateForDisplay(INSTANT, {
      dateDisplayPreset: "iso-date",
      timeZone: PARIS,
    })
  ).toBe("2026-09-06");
  expect(
    formatDateForDisplay("2026-09-05", {
      dateDisplayPreset: "iso-date",
      timeZone: "Pacific/Honolulu",
    })
  ).toBe("2026-09-05");
});

it("table cells show a column's pattern, zone, clock and spaced affixes", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <TableProvider
        locale="fr-FR"
        queryClient={new QueryClient()}
        tableId="cells"
        translations={defaultTranslations}
      >
        <p data-cell="due">
          <DataTypeCell
            column={{
              id: "due",
              header: "Due",
              type: "date",
              dateFormat: "dd/MM/yyyy HH:mm",
              timeZone: PARIS,
            }}
            fallbackDateDisplayPreset="localized-short"
            row={{}}
            value={INSTANT}
          />
        </p>
        <p data-cell="updated">
          <DataTypeCell
            column={{
              id: "updated",
              header: "Updated",
              type: "date",
              dateDisplayPreset: "time",
              timeZone: PARIS,
              hour12: false,
            }}
            row={{}}
            value={INSTANT}
          />
        </p>
        <p data-cell="score">
          <DataTypeCell
            column={{
              id: "score",
              header: "Score",
              type: "number",
              numberFormat: {
                decimals: 1,
                prefix: "≈ ",
                suffix: " pts",
                thousandsSeparator: " ",
              },
            }}
            row={{}}
            value={1234.5}
          />
        </p>
      </TableProvider>
    )
  );
  const text = (id: string) =>
    plain(container.querySelector(`[data-cell="${id}"]`)?.textContent);
  expect(text("due")).toBe("06/09/2026 00:30");
  expect(text("updated")).toBe("00:30");
  expect(text("score")).toBe("≈ 1 234,5 pts");
});
