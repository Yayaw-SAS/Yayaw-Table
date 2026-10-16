import "./setup-dom";
import {
  afterEach,
  beforeEach,
  expect,
  it,
  mock,
  setSystemTime,
} from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { act, type ComponentProps, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { DataTypeCell } from "../src/components/ui/yayaw-table/components/cells/data-type-cell";
import { InlineEditableCell } from "../src/components/ui/yayaw-table/components/cells/inline-editable-cell";
import { DateField } from "../src/components/ui/yayaw-table/components/forms/fields/date-field";
import type {
  DateFieldDefinition,
  FormFieldApi,
} from "../src/components/ui/yayaw-table/components/forms/types";
import { resolveInlineEditColumnConfig } from "../src/components/ui/yayaw-table/hooks/use-inline-edit-runtime";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";
import { formatFilterValueForDisplay } from "../src/components/ui/yayaw-table/utils/advanced-filters";

const PARIS = "Europe/Paris";
const cleanups: (() => Promise<void>)[] = [];

async function mount(children: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient();
  await act(() =>
    root.render(
      <TableProvider
        queryClient={client}
        tableId="relative-dates"
        translations={defaultTranslations}
      >
        {children}
      </TableProvider>
    )
  );
  cleanups.push(async () => {
    await act(() => root.unmount());
    client.clear();
    container.remove();
  });
  return container;
}

const settle = async () => {
  await act(() => new Promise((resolve) => setTimeout(resolve, 40)));
};

/** Types into a controlled input, as React sees it. */
const type = async (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  await act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

// A Wednesday in Paris.
beforeEach(() => setSystemTime(new Date("2026-10-14T10:00:00.000Z")));
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) {
    await cleanup();
  }
  setSystemTime();
  document.body.replaceChildren();
});

it("labels relative rules in filter chips", () => {
  expect(formatFilterValueForDisplay("date", "between", "$thisWeek")).toBe(
    "This week"
  );
  expect(
    formatFilterValueForDisplay("date", "before", ["$today"], undefined, {
      locale: "fr",
    })
  ).toBe("Aujourd’hui");
});

it("edits a date and time form field in its zone and stores an ISO instant", async () => {
  const handleChange = mock();
  const field: DateFieldDefinition = {
    name: "starts",
    label: "Starts",
    type: "date",
    withTime: true,
    timeZone: PARIS,
  };
  const fieldApi = {
    name: "starts",
    state: {
      value: "2026-10-14T07:30:00.000Z",
      meta: { errors: [], isValid: true },
    },
    handleBlur: mock(),
    handleChange,
  } as unknown as FormFieldApi<Date | string | null>;
  const container = await mount(
    <DateField field={field} fieldApi={fieldApi} />
  );
  const input = container.querySelector<HTMLInputElement>(
    'input[type="datetime-local"]'
  );
  expect(input?.value).toBe("2026-10-14T09:30");
  if (!input) {
    throw new Error("Missing date and time input");
  }
  await type(input, "2026-10-15T18:45");
  expect(handleChange).toHaveBeenLastCalledWith("2026-10-15T16:45:00.000Z");
});

it("edits a date and time cell inline and commits an ISO instant", async () => {
  const value = "2026-10-14T07:30:00.000Z";
  const row = { id: "one", starts: value };
  const column = {
    id: "starts",
    header: "Starts",
    type: "date" as const,
    withTime: true,
    timeZone: PARIS,
    dateDisplayPreset: "dateTime" as const,
  };
  const cell = {
    getValue: () => value,
    row: { original: row },
    column: { id: "starts", columnDef: { header: "Starts" } },
  } as unknown as ComponentProps<typeof InlineEditableCell>["cell"];
  const onCommit = mock(async () => ({ success: true }));
  const inlineConfig = resolveInlineEditColumnConfig(column, {
    enabled: true,
    debounceMs: 0,
  });
  const container = await mount(
    <InlineEditableCell
      cell={cell}
      displayValue={<DataTypeCell column={column} row={row} value={value} />}
      inlineConfig={inlineConfig}
      onCommit={onCommit}
      rowData={row}
    />
  );
  // The cell shows the date and its time.
  expect(container.textContent).toContain("9:30");
  await act(() =>
    container
      .querySelector("button")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  );
  const input = container.querySelector<HTMLInputElement>(
    'input[type="datetime-local"]'
  );
  expect(input?.value).toBe("2026-10-14T09:30");
  if (!input) {
    throw new Error("Missing date and time editor");
  }
  await type(input, "2026-10-14T11:00");
  await act(() => {
    input.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
    );
  });
  await settle();
  expect(onCommit).toHaveBeenCalledWith("2026-10-14T09:00:00.000Z");
});
