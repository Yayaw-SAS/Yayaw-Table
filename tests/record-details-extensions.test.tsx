import { afterAll, afterEach, expect, it, mock } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { RecordDetails } from "../src/components/ui/yayaw-table/components/details/record-details";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import {
  type DeleteConfirmationConfig,
  type DetailRelatedSection,
  deleteConfirmationMatches,
  deleteConfirmationValue,
  detailLabels,
  detailLayout,
  loadRelatedRecords,
  type RecordDetailsConfig,
  relatedView,
} from "../src/components/ui/yayaw-table/utils/record-details";

const roots: Root[] = [];
const BaseObserver = globalThis.IntersectionObserver;
const observed: Element[] = [];
/** Reports every observed element as visible, as a browser does once it scrolls into view. */
class VisibleObserver {
  readonly callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  disconnect() {
    return;
  }
  observe(target: Element) {
    observed.push(target);
    queueMicrotask(() =>
      this.callback(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver
      )
    );
  }
  unobserve() {
    return;
  }
}
globalThis.IntersectionObserver =
  VisibleObserver as unknown as typeof IntersectionObserver;
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});
afterAll(() => {
  globalThis.IntersectionObserver = BaseObserver;
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));
const company = {
  id: "c1",
  name: "Northwind",
  code: "NW-1",
  extra: { industry: "Retail" },
};
const people = [
  { id: "p1", name: "Zoé", companyId: "c1", role: "Buyer" },
  { id: "p2", name: "Adam", companyId: "c1", role: "Owner" },
  { id: "p3", name: "Other", companyId: "c2", role: "Owner" },
  { id: "p4", name: "Bea", companyId: ["c3", "c1"], role: "Advisor" },
];
const peopleSection: DetailRelatedSection = {
  kind: "related",
  id: "people",
  title: "People",
  source: "people",
  foreignKey: "companyId",
  columns: [
    { id: "name", label: "Name" },
    { id: "role", label: "Role" },
  ],
  sort: { id: "name" },
  limit: 2,
  rows: people,
  open: { action: "open-person" },
  add: { action: "add-person", label: "Add person" },
};
const button = (label: string, scope: ParentNode = document) => {
  const found = Array.from(scope.querySelectorAll("button")).find(
    (item) => item.textContent?.trim() === label
  );
  if (!found) {
    throw new Error(`Missing button ${label}`);
  }
  return found;
};
const typeInto = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};
const mountNode = async (node: ReactNode) => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => {
    root.render(node);
    await settle();
  });
  return host;
};

it("resolves typed confirmation values for records and bulk deletions", () => {
  const labels = detailLabels("en");
  const typed: DeleteConfirmationConfig = { type: "typed" };
  expect(
    deleteConfirmationValue(undefined, { row: company, title: "N" }, labels)
  ).toBeUndefined();
  expect(
    deleteConfirmationValue(typed, { row: company, title: "Northwind" }, labels)
  ).toBe("Northwind");
  expect(
    deleteConfirmationValue(
      { type: "typed", match: "column", column: "code" },
      { row: company, title: "Northwind" },
      labels
    )
  ).toBe("NW-1");
  expect(
    deleteConfirmationValue(
      { type: "typed", match: "column", column: "missing" },
      { row: company, title: "Northwind" },
      labels
    )
  ).toBe("DELETE");
  expect(
    deleteConfirmationValue(
      { type: "typed", match: "text", text: "erase" },
      { row: company, title: "Northwind" },
      labels
    )
  ).toBe("erase");
  expect(deleteConfirmationValue(typed, { count: 3 }, labels)).toBe("3");
  expect(
    deleteConfirmationValue(
      { type: "typed", bulkMatch: "text" },
      { count: 3 },
      detailLabels("fr")
    )
  ).toBe("SUPPRIMER");
  expect(deleteConfirmationMatches("NW-1", " nw-1 ")).toBe(true);
  expect(
    deleteConfirmationMatches("NW-1", "nw-1", { caseSensitive: true })
  ).toBe(false);
  expect(deleteConfirmationMatches(undefined, "")).toBe(true);
});

it("lays out related and custom sections after the derived fields", async () => {
  const layout = detailLayout(
    {
      sections: [
        peopleSection,
        { kind: "custom", id: "extra", title: "Extra" },
        { kind: "custom", id: "hidden", title: "Hidden", hidden: true },
      ],
    },
    [{ id: "name", header: "Name", type: "text" }],
    company,
    "Details"
  );
  expect(layout.map((item) => `${item.kind}:${item.section.id}`)).toEqual([
    "fields:record",
    "related:people",
    "custom:extra",
  ]);
  const rows = await loadRelatedRecords(peopleSection, company);
  expect(rows.map((row) => row.id)).toEqual(["p1", "p2", "p4"]);
  const view = relatedView(peopleSection, rows);
  expect(view.rows.map((row) => row.name)).toEqual(["Adam", "Bea"]);
  expect(view.total).toBe(3);
});

it("requires the typed title before deleting a record", async () => {
  const remove = mock(() => ({ success: true }));
  const close = mock(() => undefined);
  const config: RecordDetailsConfig = {
    presentation: "inline",
    deleteConfirmation: { type: "typed" },
    sections: [
      { id: "main", title: "Main", fields: [{ id: "code", label: "Code" }] },
    ],
  };
  await mountNode(
    <RecordDetails
      config={config}
      onClose={close}
      onDelete={remove}
      row={company}
    />
  );
  await act(async () => {
    button("Delete").click();
    await settle();
  });
  const modal = document.querySelector('[role="alertdialog"]');
  const input = modal?.querySelector<HTMLInputElement>("input");
  if (!(modal && input)) {
    throw new Error("Missing typed confirmation");
  }
  expect(document.activeElement).toBe(input);
  const label = modal.querySelector(`label[for="${input.id}"]`);
  expect(label?.textContent).toBe("Type “Northwind” to confirm.");
  const confirm = button("Delete", modal);
  expect(confirm.disabled).toBe(true);
  await act(async () => {
    typeInto(input, "North");
    await settle();
  });
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(modal.textContent).toContain("The text does not match.");
  expect(confirm.disabled).toBe(true);
  confirm.click();
  expect(remove).not.toHaveBeenCalled();
  await act(async () => {
    typeInto(input, "northwind");
    await settle();
  });
  expect(confirm.disabled).toBe(false);
  await act(async () => {
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    await settle();
  });
  expect(remove).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
});

it("lists related records lazily with host actions, empty and error states", async () => {
  const onRelatedAction = mock((_event: unknown) => undefined);
  let failures = 1;
  const loadRelated = mock(async (..._args: unknown[]) => {
    await Promise.resolve();
    if (failures > 0) {
      failures -= 1;
      throw new Error("Server unavailable");
    }
    return [{ id: "d1", title: "Renewal", amount: 1200 }];
  });
  const config: RecordDetailsConfig = {
    presentation: "inline",
    loadRelated,
    onRelatedAction,
    sections: [
      { id: "main", title: "Main", fields: [{ id: "name", label: "Name" }] },
      peopleSection,
      {
        kind: "related",
        id: "deals",
        title: "Deals",
        source: "deals",
        foreignKey: "companyId",
        columns: [
          { id: "title", label: "Deal" },
          { id: "amount", label: "Amount", type: "number" },
        ],
        collapsed: true,
      },
      {
        kind: "related",
        id: "none",
        title: "Notes",
        source: "notes",
        foreignKey: "companyId",
        columns: [{ id: "text", label: "Text" }],
        rows: [],
        empty: "No notes yet.",
      },
    ],
  };
  const host = await mountNode(
    <RecordDetails config={config} onClose={() => undefined} row={company} />
  );
  const people = host.querySelector('[data-related-section="people"]');
  if (!people) {
    throw new Error("Missing related section");
  }
  expect(people.querySelector("h3")?.textContent).toBe("People3");
  expect(
    Array.from(people.querySelectorAll("tbody tr")).map(
      (row) => row.querySelector("td")?.textContent
    )
  ).toEqual(["Adam", "Bea"]);
  expect(people.textContent).toContain("1 more");
  expect(host.textContent).toContain("No notes yet.");
  await act(async () => {
    button("Add person", people).click();
    button("Open", people).click();
    await settle();
  });
  expect(onRelatedAction.mock.calls.map((call) => call[0])).toEqual([
    expect.objectContaining({
      action: "add-person",
      kind: "add",
      row: company,
    }),
    expect.objectContaining({
      action: "open-person",
      kind: "open",
      related: expect.objectContaining({ id: "p2" }),
    }),
  ]);
  // A closed section loads once opened and visible.
  expect(observed.length).toBeGreaterThan(0);
  expect(loadRelated).not.toHaveBeenCalled();
  const deals = host.querySelector('[data-related-section="deals"]');
  const toggle = deals?.querySelector<HTMLButtonElement>("h3 button");
  if (!(deals && toggle)) {
    throw new Error("Missing deals");
  }
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  await act(async () => {
    toggle.click();
    await settle();
  });
  expect(loadRelated).toHaveBeenCalledTimes(1);
  expect(loadRelated.mock.calls[0]?.[2]).toEqual(
    expect.objectContaining({ value: "c1" })
  );
  expect(deals.querySelector('[role="alert"]')?.textContent).toContain(
    "Server unavailable"
  );
  await act(async () => {
    button("Retry", deals).click();
    await settle();
  });
  expect(loadRelated).toHaveBeenCalledTimes(2);
  expect(deals.querySelector("tbody")?.textContent).toContain("Renewal");
});

it("renders host fields and custom sections from the record details config", async () => {
  const config: RecordDetailsConfig<ReactNode> = {
    presentation: "inline",
    sections: [
      {
        id: "main",
        title: "Main",
        fields: [
          { id: "name", label: "Name" },
          { id: "extra.industry", label: "Industry", type: "custom" },
        ],
      },
      {
        kind: "custom",
        id: "custom-fields",
        title: "Custom fields",
        data: { column: "extra" },
      },
      { kind: "custom", id: "unrendered", title: "Unrendered" },
    ],
    renderField: (field, value) =>
      field.type === "custom" ? <em>{String(value)}</em> : undefined,
    renderSection: (section, row) =>
      section.id === "custom-fields" ? (
        <p data-host-section="">
          {Object.keys(row[String(section.data?.column)] as object).join(",")}
        </p>
      ) : undefined,
  };
  const host = await mountNode(
    <RecordDetails config={config} onClose={() => undefined} row={company} />
  );
  expect(host.querySelector("em")?.textContent).toBe("Retail");
  expect(host.textContent).toContain("Northwind");
  expect(host.querySelector("[data-host-section]")?.textContent).toBe(
    "industry"
  );
  expect(host.textContent).toContain("Custom fields");
  expect(host.textContent).not.toContain("Unrendered");
});

it("asks a typed confirmation for row and bulk deletions in a table", async () => {
  const id = "typed-delete-table";
  const rows = [
    { id: "r1", name: "Alpha", code: "A-1" },
    { id: "r2", name: "Beta", code: "B-2" },
  ];
  const tableConfig = defineTableConfig({
    id,
    columns: {
      definitions: [{ id: "name", header: "Name", type: "text" }],
      visible: ["name"],
      order: ["name"],
      mandatory: ["name"],
    },
    table: {
      syncUrl: false,
      allowCreate: false,
      allowEdit: false,
      allowDuplicate: false,
      deleteConfirmation: { type: "typed", match: "column", column: "code" },
    },
    translations: { namespace: id, keys: {} },
  });
  const remove = mock(async () => ({ success: true }));
  const bulkDelete = mock(async () => ({ success: true }));
  const actions = {
    list: mock(async () => ({
      data: rows,
      meta: { pageCount: 1, totalCount: rows.length },
    })),
    delete: remove,
    bulkDelete,
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const host = await mountNode(
    <Provider store={createStore()}>
      <NuqsTestingAdapter hasMemory>
        <DataTable
          details={false}
          enableToolbar={false}
          getTableActions={() => actions}
          getTableConfig={() => tableConfig}
          initialData={rows}
          initialPageCount={1}
          initialRowCount={rows.length}
          queryClient={client}
          tableType={id}
        />
      </NuqsTestingAdapter>
    </Provider>
  );
  const trigger = host.querySelector<HTMLButtonElement>(
    'tbody [aria-label="Actions"]'
  );
  if (!trigger) {
    throw new Error("Missing row actions");
  }
  await act(async () => {
    trigger.click();
    await settle();
  });
  const deleteItem = Array.from(
    document.querySelectorAll<HTMLElement>('[role="menuitem"]')
  ).find((item) => item.textContent?.trim() === "Delete");
  await act(async () => {
    deleteItem?.click();
    await settle();
  });
  const dialog = document.querySelector('[role="alertdialog"]');
  const input = dialog?.querySelector<HTMLInputElement>("input");
  if (!(dialog && input)) {
    throw new Error("Missing row typed confirmation");
  }
  expect(dialog.textContent).toContain("Type “A-1” to confirm.");
  expect(button("Delete", dialog).disabled).toBe(true);
  expect(remove).not.toHaveBeenCalled();
  await act(async () => {
    typeInto(input, "a-1");
    await settle();
  });
  await act(async () => {
    button("Delete", dialog).click();
    await settle();
  });
  expect(remove).toHaveBeenCalledTimes(1);

  const checkbox = host.querySelector<HTMLElement>(
    'tbody [role="checkbox"], tbody input[type="checkbox"]'
  );
  await act(async () => {
    checkbox?.click();
    await settle();
  });
  const bulkDeleteButton = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Delete"]'
  );
  if (!bulkDeleteButton) {
    throw new Error("Missing bulk delete");
  }
  await act(async () => {
    bulkDeleteButton.click();
    await settle();
  });
  const bulkDialog = Array.from(
    document.querySelectorAll('[role="alertdialog"]')
  ).find((item) => item.querySelector("input[data-typed-confirmation]"));
  const bulkInput = bulkDialog?.querySelector<HTMLInputElement>("input");
  if (!(bulkDialog && bulkInput)) {
    throw new Error("Missing bulk typed confirmation");
  }
  expect(bulkDialog.textContent).toContain("Type “1” to confirm.");
  const confirm = button("Confirm", bulkDialog);
  expect(confirm.disabled).toBe(true);
  await act(async () => {
    typeInto(bulkInput, "1");
    await settle();
  });
  expect(confirm.disabled).toBe(false);
  await act(async () => {
    confirm.click();
    await settle();
  });
  expect(bulkDelete).toHaveBeenCalledTimes(1);
  client.clear();
});
