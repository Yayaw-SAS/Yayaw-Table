import { expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import { usePlanningState } from "../src/components/ui/yayaw-table/planning/react";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";

const ROWS = [
  { id: "a", name: "Design", start: "2026-09-14", end: "2026-09-16" },
  { id: "b", name: "Build", start: "2026-09-17", end: "2026-09-21" },
];

const ganttConfig = (gantt?: Record<string, string>) =>
  defineTableConfig({
    id: "zero-config",
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        { id: "start", header: "Start", type: "date" },
        { id: "end", header: "End", type: "date" },
      ],
      mandatory: ["name"],
      order: ["name", "start", "end"],
      visible: ["name", "start", "end"],
    },
    table: {
      defaultDisplayMode: "gantt",
      displayModes: ["table", "gantt"],
      planning: {
        enabled: true,
        scopeId: "zero-config",
        sourceId: "tasks",
      },
      gantt,
    },
    translations: { namespace: "zero-config", keys: { title: "Zero config" } },
  });

/** Only the list/update actions any table already has — no planning adapter. */
const tableActions = (saved: Record<string, unknown>[]) => ({
  list: () => Promise.resolve({ data: ROWS, meta: { pageCount: 1 } }),
  update: (id: string, data: Record<string, unknown>) => {
    saved.push({ id, ...data });
    return Promise.resolve({ success: true });
  },
});

async function renderPlanning(gantt?: Record<string, string>) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const queryClient = new QueryClient();
  const saved: Record<string, unknown>[] = [];
  const seen: ReturnType<typeof usePlanningState>[] = [];

  function Probe() {
    seen.push(usePlanningState());
    return null;
  }

  await act(() =>
    root.render(
      <NuqsTestingAdapter hasMemory>
        <Provider>
          <TableProvider
            getTableActions={() => tableActions(saved)}
            getTableConfig={() => ganttConfig(gantt)}
            queryClient={queryClient}
            tableId="zero-config"
            translations={defaultTranslations}
          >
            <Probe />
          </TableProvider>
        </Provider>
      </NuqsTestingAdapter>
    )
  );
  // The session loads its graph asynchronously once connected.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

  return {
    saved,
    latest: () => seen.at(-1),
    async dispose() {
      await act(() => root.unmount());
      container.remove();
      queryClient.clear();
    },
  };
}

it("derives a planning graph from the table's own rows", async () => {
  const harness = await renderPlanning({
    titleColumn: "name",
    startColumn: "start",
    endColumn: "end",
  });
  try {
    const state = harness.latest();
    expect(state?.session).toBeDefined();
    expect(state?.state.snapshot?.complete).toBe(true);
    expect(state?.state.snapshot?.tasks.map((task) => task.label)).toEqual([
      "Design",
      "Build",
    ]);
    expect(state?.state.error).toBeUndefined();
  } finally {
    await harness.dispose();
  }
});

it("withholds planning until the date columns are mapped", async () => {
  const harness = await renderPlanning({ titleColumn: "name" });
  try {
    expect(harness.latest()?.session).toBeUndefined();
  } finally {
    await harness.dispose();
  }
});

it("saves a derived planning edit through the table's update action", async () => {
  const harness = await renderPlanning({
    titleColumn: "name",
    startColumn: "start",
    endColumn: "end",
  });
  try {
    const session = harness.latest()?.session;
    expect(session).toBeDefined();
    const pending = session?.request([
      { type: "move", ref: { source: "tasks", id: "b" }, days: 1 },
    ]);
    for (
      let attempt = 0;
      attempt < 50 && !session?.getState().preview;
      attempt += 1
    ) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    // The default "preview" mode waits for confirmation before writing.
    expect(session?.getState().preview).toBeDefined();
    expect(harness.saved).toHaveLength(0);
    await act(async () => {
      await session?.apply();
    });
    expect((await pending)?.success).toBe(true);
    expect(harness.saved).toEqual([
      { id: "b", start: "2026-09-18", end: "2026-09-22" },
    ]);
  } finally {
    await harness.dispose();
  }
});

it("renders the timeline with the table's own cells and selection", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const queryClient = new QueryClient();
  const saved: Record<string, unknown>[] = [];
  try {
    await act(() =>
      root.render(
        <NuqsTestingAdapter hasMemory>
          <Provider>
            <DataTable
              getTableActions={() => tableActions(saved)}
              getTableConfig={() =>
                ganttConfig({
                  titleColumn: "name",
                  startColumn: "start",
                  endColumn: "end",
                })
              }
              queryClient={queryClient}
              tableType="zero-config"
            />
          </Provider>
        </NuqsTestingAdapter>
      )
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    const timeline = container.querySelector("section[aria-label]");
    expect(timeline).not.toBeNull();
    // One bar per task, each labelled with its own interval.
    const bars = container.querySelectorAll('button[aria-label^="Move "]');
    expect(bars).toHaveLength(2);
    // The left column carries the table's selection cells, not a rebuilt label.
    expect(
      container.querySelectorAll('[data-slot="checkbox"]').length
    ).toBeGreaterThan(0);
    expect(timeline?.textContent).toContain("Design");
  } finally {
    await act(() => root.unmount());
    container.remove();
    queryClient.clear();
  }
});
