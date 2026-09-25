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
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { AdvancedFilterPanel } from "../src/components/ui/yayaw-table/components/filters/advanced-filter-panel";
import {
  DateFilter,
  DateRangeShortcuts,
} from "../src/components/ui/yayaw-table/components/filters/date-filter";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";

const SEPTEMBER_DAY = /September (\d+)/;

/** What older versions stored for a day: the instant of the viewer's local midnight. */
const localMidnight = (day: number) => new Date(2026, 8, day).toISOString();

async function mount(children: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient();
  await act(() =>
    root.render(
      <TableProvider
        queryClient={client}
        tableId="date-filter"
        translations={defaultTranslations}
      >
        {children}
      </TableProvider>
    )
  );
  return {
    container,
    cleanup: async () => {
      await act(() => root.unmount());
      client.clear();
      container.remove();
    },
  };
}

const dayButton = (container: HTMLElement, label: string) => {
  const button = [...container.querySelectorAll("button")].find((item) =>
    item.getAttribute("aria-label")?.includes(label)
  );
  if (!button) {
    throw new Error(`Missing day: ${label}`);
  }
  return button;
};

const selectedDays = (container: HTMLElement) =>
  [...container.querySelectorAll("button")]
    .map((item) => item.getAttribute("aria-label") ?? "")
    .filter((label) => label.endsWith(", selected"))
    .map((label) => label.match(SEPTEMBER_DAY)?.[1]);

beforeEach(() => setSystemTime(new Date(2026, 8, 25, 10, 30)));
afterEach(() => setSystemTime());

it("picks one calendar day, whatever the time of the click", async () => {
  const onValueChange = mock();
  const view = await mount(
    <DateFilter
      inline
      onOperatorChange={mock()}
      onValueChange={onValueChange}
      operator="equals"
      value="2026-09-05"
    />
  );
  try {
    expect(selectedDays(view.container)).toEqual(["5"]);
    await act(() => dayButton(view.container, "September 9th, 2026").click());
    expect(onValueChange).toHaveBeenLastCalledWith("2026-09-09");
  } finally {
    await view.cleanup();
  }
});

it("picks a range of days and shows an older rule's instants as its days", async () => {
  const onValueChange = mock();
  const view = await mount(
    <DateFilter
      inline
      onOperatorChange={mock()}
      onValueChange={onValueChange}
      operator="between"
      value={[localMidnight(5), localMidnight(12)]}
    />
  );
  try {
    expect(selectedDays(view.container)).toEqual([
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
    ]);
    await act(() => dayButton(view.container, "September 20th, 2026").click());
    expect(onValueChange).toHaveBeenLastCalledWith([
      "2026-09-05",
      "2026-09-20",
    ]);
  } finally {
    await view.cleanup();
  }
});

it("shortcuts pick the viewer's days", async () => {
  const onSelect = mock();
  const view = await mount(<DateRangeShortcuts onSelect={onSelect} />);
  const click = async (text: string) => {
    const button = [...view.container.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === text
    );
    await act(() => button?.click());
  };
  try {
    await click("Today");
    expect(onSelect).toHaveBeenLastCalledWith(["2026-09-25", "2026-09-25"]);
    await click("Yesterday");
    expect(onSelect).toHaveBeenLastCalledWith(["2026-09-24", "2026-09-24"]);
    await click("Last 7 days");
    expect(onSelect).toHaveBeenLastCalledWith(["2026-09-19", "2026-09-25"]);
    await click("Last 30 days");
    expect(onSelect).toHaveBeenLastCalledWith(["2026-08-27", "2026-09-25"]);
    await click("This month");
    expect(onSelect).toHaveBeenLastCalledWith(["2026-09-01", "2026-09-30"]);
  } finally {
    await view.cleanup();
  }
});

it("adds a date rule on today's day", async () => {
  const actions = {
    addFilter: mock(),
    updateFilter: mock(),
    removeFilter: mock(),
    toggleFilter: mock(),
    clearFilters: mock(),
    applyPreset: mock(),
    savePreset: mock(),
  };
  const view = await mount(
    <AdvancedFilterPanel
      actions={actions}
      columnsConfig={{ due: { type: "date", label: "Due" } }}
      filters={[]}
    />
  );
  const click = async (text: string) => {
    const button = [...view.container.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === text
    );
    if (!button) {
      throw new Error(`Missing button: ${text}`);
    }
    await act(() => button.click());
  };
  try {
    await click("Due");
    await click("Done");
    expect(actions.addFilter).toHaveBeenLastCalledWith(
      expect.objectContaining({
        columnId: "due",
        type: "date",
        operator: "equals",
        values: "2026-09-25",
      })
    );
  } finally {
    await view.cleanup();
  }
});
