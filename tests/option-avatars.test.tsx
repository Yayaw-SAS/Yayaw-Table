import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTypeCell } from "../src/components/ui/yayaw-table/components/cells/data-type-cell";
import type { ColumnDefinition } from "../src/components/ui/yayaw-table/config/helpers";
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

const owners = {
  id: "owners",
  header: "Owners",
  type: "multiSelect",
  displayVariant: "avatars",
  options: [
    { value: 1, label: "Ada Lovelace", image: "https://example.com/ada.jpg" },
    { value: 2, label: "Grace Hopper" },
  ],
} as unknown as ColumnDefinition;

const render = async (column: ColumnDefinition, value: unknown) => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <TableProvider
        queryClient={new QueryClient()}
        tableId="owners"
        translations={defaultTranslations}
      >
        <DataTypeCell column={column} row={{ id: "1" }} value={value} />
      </TableProvider>
    )
  );
  return container;
};

it("shows people as avatars: the option's image, else initials, each named for screen readers", async () => {
  const container = await render(owners, [1, 2, null]);
  const items = [
    ...container.querySelectorAll<HTMLElement>(".yayaw-avatar-stack-item"),
  ];
  // Same markup as the Vue cell.
  expect(items.map((item) => item.getAttribute("aria-label"))).toEqual([
    "Ada Lovelace",
    "Grace Hopper",
  ]);
  expect(items[0]?.querySelector("img")?.getAttribute("src")).toBe(
    "https://example.com/ada.jpg"
  );
  expect(items[1]?.textContent).toBe("GH");
  expect(container.querySelector(".yayaw-tag")).toBeNull();
});

it("keeps tags for the other option columns", async () => {
  const container = await render(
    { ...owners, displayVariant: "tag" } as ColumnDefinition,
    [2]
  );
  expect(container.querySelector(".yayaw-avatar-stack")).toBeNull();
  expect(container.textContent).toContain("Grace Hopper");
});
