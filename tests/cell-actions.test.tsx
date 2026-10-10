import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CellWithActions } from "../src/components/ui/yayaw-table/components/cells/cell-actions";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});

const render = async (node: React.ReactNode) => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <TableProvider
        queryClient={new QueryClient()}
        tableId="cell-actions"
        translations={defaultTranslations}
      >
        {node}
      </TableProvider>
    )
  );
  return container;
};

it("draws the value, then its actions at the control size, and keeps clicks off the row", async () => {
  const clicks: unknown[] = [];
  let rowClicks = 0;
  // The row's own listener sits above the React root.
  const onRowClick = () => rowClicks++;
  document.body.addEventListener("click", onRowClick);
  const container = await render(
    <CellWithActions
      column={{
        id: "note",
        header: "Note",
        copyable: true,
        cellActions: [
          {
            id: "add",
            label: "Add a note",
            icon: <svg />,
            count: (row) => Number(row.notes),
            onClick: (row, value) => clicks.push([row.id, value]),
          },
          { id: "open", label: "Open", href: () => "/notes/1" },
        ],
      }}
      row={{ id: "1", notes: 2 }}
      value="Last note"
    >
      Last note
    </CellWithActions>
  );

  const actions = [
    ...container.querySelectorAll<HTMLElement>("[data-cell-action]"),
  ];
  // Same contract as the Vue cell: declaration order, the copy action last.
  expect(actions.map((action) => action.dataset.cellAction)).toEqual([
    "add",
    "open",
    "copy",
  ]);
  expect(actions[0]?.getAttribute("aria-label")).toBe("Add a note");
  expect(actions[0]?.textContent).toBe("2");
  expect(actions[0]?.className).toContain(
    "h-[var(--yayaw-inline-control-height,1.75rem)]"
  );
  expect(actions[1]?.getAttribute("href")).toBe("/notes/1");
  expect(actions[1]?.getAttribute("rel")).toBe("noopener noreferrer");
  expect(actions[2]?.getAttribute("aria-label")).toBe("Copy");

  await act(() => actions[0]?.click());
  expect(clicks).toEqual([["1", "Last note"]]);
  expect(rowClicks).toBe(0);
  document.body.removeEventListener("click", onRowClick);
});

it("renders the plain value when no action applies", async () => {
  const container = await render(
    <CellWithActions
      column={{ id: "name", header: "Name", copyable: true }}
      row={{ id: "1" }}
      value=""
    >
      —
    </CellWithActions>
  );
  expect(container.querySelector("[data-cell-actions]")).toBeNull();
  expect(container.textContent).toBe("—");
});

it("ignores a disabled action's click without passing it to the row", async () => {
  let calls = 0;
  let rowClicks = 0;
  const onRowClick = () => rowClicks++;
  document.body.addEventListener("click", onRowClick);
  const container = await render(
    <CellWithActions
      column={{
        id: "name",
        header: "Name",
        cellActions: [
          {
            id: "locked",
            label: "Locked",
            disabled: () => true,
            onClick: () => calls++,
          },
        ],
      }}
      row={{ id: "1" }}
      value="Name"
    >
      Name
    </CellWithActions>
  );
  const action = container.querySelector<HTMLElement>("[data-cell-action]");
  expect(action?.getAttribute("aria-disabled")).toBe("true");
  await act(() => action?.click());
  expect(calls).toBe(0);
  expect(rowClicks).toBe(0);
  document.body.removeEventListener("click", onRowClick);
});
