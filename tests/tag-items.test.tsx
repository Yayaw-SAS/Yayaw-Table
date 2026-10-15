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

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});

const row = {
  id: "7",
  activations: [
    { id: 1, name: "Reel 1", posts: 2 },
    { id: 2, name: "Story", posts: 0 },
  ],
};

it("draws each tag from the row's tagItem and keeps tag clicks off the row", async () => {
  const clicks: unknown[] = [];
  let rowClicks = 0;
  const onRowClick = () => rowClicks++;
  document.body.addEventListener("click", onRowClick);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <TableProvider
        queryClient={new QueryClient()}
        tableId="tag-items"
        translations={defaultTranslations}
      >
        <DataTypeCell
          column={{
            id: "activations",
            header: "Activations",
            type: "tag",
            tagItem: (value) => {
              const activation = value as (typeof row.activations)[number];
              return {
                label: activation.name,
                tone: activation.posts > 0 ? "success" : "neutral",
                icon: <svg data-icon="" />,
                title: `Activation #${activation.id}`,
              };
            },
            onTagClick: (value, record) =>
              clicks.push([(value as { id: number }).id, record.id]),
          }}
          row={row}
          value={row.activations}
        />
      </TableProvider>
    )
  );

  const tags = [...container.querySelectorAll<HTMLElement>(".yayaw-tag")];
  expect(tags.map((tag) => tag.textContent)).toEqual(["Reel 1", "Story"]);
  expect(tags.map((tag) => tag.tagName)).toEqual(["BUTTON", "BUTTON"]);
  expect(tags.map((tag) => tag.getAttribute("type"))).toEqual([
    "button",
    "button",
  ]);
  expect(tags.map((tag) => tag.title)).toEqual([
    "Activation #1",
    "Activation #2",
  ]);
  expect(tags.map((tag) => tag.dataset.colored)).toEqual(["true", "false"]);
  expect(tags[0]?.style.getPropertyValue("--yayaw-tag-color")).toBe(
    "var(--yayaw-success, #16a34a)"
  );
  expect(tags.every((tag) => tag.querySelector("[data-icon]"))).toBe(true);

  await act(() => tags[1]?.click());
  expect(clicks).toEqual([[2, "7"]]);
  expect(rowClicks).toBe(0);
  document.body.removeEventListener("click", onRowClick);
});

it("keeps option tags as plain labels without tagItem or onTagClick", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <TableProvider
        queryClient={new QueryClient()}
        tableId="tag-items"
        translations={defaultTranslations}
      >
        <DataTypeCell
          column={{
            id: "status",
            header: "Status",
            type: "tag",
            options: [{ value: "done", label: "Done", color: "green" }],
          }}
          row={{ id: "1" }}
          value="done"
        />
      </TableProvider>
    )
  );
  const tag = container.querySelector<HTMLElement>(".yayaw-tag");
  expect(tag?.tagName).toBe("SPAN");
  expect(tag?.textContent).toBe("Done");
  expect(tag?.dataset.tagButton).toBeUndefined();
});
