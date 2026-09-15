import { afterEach, expect, it, mock } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import {
  catalogueFormAtom,
  openCreateForm,
  openUpdateForm,
} from "../src/components/ui/yayaw-table/components/forms/atoms/catalogue-form-atoms";
import { CatalogueBulkEditor } from "../src/components/ui/yayaw-table/components/forms/catalogue-bulk-editor";
import { CatalogueForm } from "../src/components/ui/yayaw-table/components/forms/catalogue-form";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";
import {
  RECORD_MOBILE_QUERY,
  type RecordPresentationConfig,
  resolveRecordPresentation,
} from "../src/components/ui/yayaw-table/utils/record-presentation";
import fixtures from "./fixtures/record-presentation.json";

for (const fixture of fixtures) {
  it(fixture.name, () => {
    expect(
      resolveRecordPresentation(
        fixture.presentation as RecordPresentationConfig | undefined,
        fixture.mobile,
        fixture.legacy as RecordPresentationConfig | undefined
      )
    ).toBe(fixture.expected as ReturnType<typeof resolveRecordPresentation>);
  });
}
const roots: Root[] = [];
const clients: QueryClient[] = [];
const originalMedia = window.matchMedia;
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  for (const client of clients.splice(0)) {
    client.clear();
  }
  window.matchMedia = originalMedia;
  document.body.replaceChildren();
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 40));
const row: Record<string, unknown> = { id: "one", name: "Example" };
const form = {
  id: "records",
  presentation: "modal" as const,
  submitMode: "patch" as const,
  fields: [{ name: "name", label: "Name", type: "text" as const }],
};
function configuration(presentation?: RecordPresentationConfig) {
  return defineTableConfig({
    id: "records",
    presentation,
    columns: {
      definitions: [{ id: "name", header: "Name", type: "text" }],
      visible: ["name"],
      order: ["name"],
      mandatory: [],
    },
    table: {
      syncUrl: false,
      rowClickMode: "activate",
      enableRowSelection: false,
      allowDelete: false,
    },
    translations: { namespace: "records", keys: {} },
  });
}
function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  return {
    client,
    host,
    render: async (children: ReactNode) => {
      await act(async () => {
        root.render(children);
        await settle();
      });
    },
  };
}
function button(label: string) {
  const result = Array.from(document.querySelectorAll("button")).find(
    (item) => item.textContent?.trim() === label
  );
  if (!result) {
    throw new Error(`Missing ${label}`);
  }
  return result;
}
function responsive() {
  let mobile = false;
  const events = document.createElement("div");
  const media = {
    get matches() {
      return mobile;
    },
    media: RECORD_MOBILE_QUERY,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  } as MediaQueryList;
  window.matchMedia = (query) =>
    query === RECORD_MOBILE_QUERY ? media : originalMedia.call(window, query);
  return async (next: boolean) => {
    await act(() => {
      mobile = next;
      events.dispatchEvent(new Event("change"));
    });
  };
}
async function fill(value: string) {
  const input = document.querySelector<HTMLInputElement>(
    ".yayaw-record-body input"
  );
  if (!input) {
    throw new Error("Missing form input");
  }
  await act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return input;
}
for (const presentation of ["drawer", "modal", "inline"] as const) {
  it(`keeps consultation and edit in the same ${presentation} surface, including cancel and save`, async () => {
    const view = mount();
    const update = mock(async () => ({ success: true }));
    const store = createStore();
    await view.render(
      <Provider store={store}>
        <NuqsTestingAdapter hasMemory>
          <DataTable
            details={{ presentation: "modal" }}
            getFormConfig={() => form}
            getTableActions={() => ({ update })}
            getTableConfig={() => configuration(presentation)}
            initialData={[row, { id: "two", name: "Other record" }]}
            initialPageCount={1}
            initialRowCount={1}
            queryClient={view.client}
            tableType="records"
          />
        </NuqsTestingAdapter>
      </Provider>
    );
    await act(async () => {
      view.host.querySelector<HTMLTableCellElement>("tbody td")?.click();
      await settle();
    });
    const surface = document.querySelector(".yayaw-record-surface");
    expect(surface?.getAttribute("data-presentation")).toBe(presentation);
    await act(async () => {
      button("Edit").click();
      await settle();
    });
    expect(document.querySelector(".yayaw-record-surface")).toBe(surface);
    expect(document.querySelectorAll(".yayaw-record-surface")).toHaveLength(1);
    const draft = await fill("Cancelled draft");
    if (presentation === "inline") {
      await act(() =>
        view.host
          .querySelectorAll<HTMLTableCellElement>("tbody tr")[1]
          ?.querySelector<HTMLTableCellElement>("td")
          ?.click()
      );
      expect(document.querySelector(".yayaw-record-body input")).toBe(draft);
      expect(draft.value).toBe("Cancelled draft");
    }
    await act(() => button("Cancel").click());
    expect(surface?.textContent).toContain("Example");
    expect(update).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button("Edit"));
    await act(async () => {
      button("Edit").click();
      await settle();
    });
    expect(
      document.querySelector<HTMLInputElement>(".yayaw-record-body input")
        ?.value
    ).toBe("Example");
    await fill("Updated");
    await act(async () => {
      button("Save").click();
      await settle();
    });
    expect(update).toHaveBeenCalledWith("one", { name: "Updated" }, { row });
    expect(document.querySelector(".yayaw-record-surface")).toBe(surface);
    expect(document.querySelector(".yayaw-detail")).not.toBeNull();
    if (presentation === "inline") {
      await act(async () => {
        store.set(catalogueFormAtom, openCreateForm("records", "records"));
        await settle();
      });
      expect(document.querySelectorAll(".yayaw-record-surface")).toHaveLength(
        1
      );
      expect(document.querySelector(".yayaw-detail")).toBeNull();
      await act(() => button("Cancel").click());
      expect(document.querySelector(".yayaw-record-surface")).toBeNull();
    }
  });
  for (const operation of ["create", "edit", "bulk"] as const) {
    it(`applies the shared ${presentation} setting to ${operation} ahead of legacy modal settings`, async () => {
      const view = mount();
      const store = createStore();
      store.set(
        catalogueFormAtom,
        operation === "create"
          ? openCreateForm("records", "records")
          : openUpdateForm("records", "records", row)
      );
      await view.render(
        <Provider store={store}>
          <TableProvider
            getFormConfig={() => form}
            getTableActions={() => ({
              create: async () => ({ success: true }),
              update: async () => ({ success: true }),
              bulkUpdate: async () => ({ success: true }),
            })}
            getTableConfig={() => configuration(presentation)}
            queryClient={view.client}
            tableId="records"
            translations={defaultTranslations}
          >
            {operation === "bulk" ? (
              <CatalogueBulkEditor
                onClose={() => undefined}
                onCompleted={async () => undefined}
                tableId="records"
                tableType="records"
                targets={[{ id: "one", row }]}
              />
            ) : (
              <CatalogueForm />
            )}
          </TableProvider>
        </Provider>
      );
      expect(
        document
          .querySelector(".yayaw-record-surface")
          ?.getAttribute("data-presentation")
      ).toBe(presentation);
      expect(document.querySelectorAll(".yayaw-record-header")).toHaveLength(1);
      expect(document.querySelector(".yayaw-record-footer")).not.toBeNull();
      expect(document.querySelector('[role="dialog"]') !== null).toBe(
        presentation !== "inline"
      );
    });
  }
}
it("preserves an edited value and the dialog node across the mobile override", async () => {
  const resize = responsive();
  const view = mount();
  const store = createStore();
  store.set(catalogueFormAtom, openUpdateForm("records", "records", row));
  await view.render(
    <Provider store={store}>
      <TableProvider
        getFormConfig={() => form}
        getTableConfig={() =>
          configuration({ desktop: "drawer", mobile: "modal" })
        }
        queryClient={view.client}
        tableId="records"
        translations={defaultTranslations}
      >
        <CatalogueForm />
      </TableProvider>
    </Provider>
  );
  const surface = document.querySelector(".yayaw-record-surface");
  const input = await fill("Mobile draft");
  await resize(true);
  expect(document.querySelector(".yayaw-record-surface")).toBe(surface);
  expect(surface?.getAttribute("data-presentation")).toBe("modal");
  expect(document.querySelector(".yayaw-record-body input")).toBe(input);
  expect(input.value).toBe("Mobile draft");
  await resize(false);
  expect(surface?.getAttribute("data-presentation")).toBe("drawer");
  expect(input.value).toBe("Mobile draft");
});

for (const mobile of ["modal", "inline"] as const) {
  it(`preserves the embedded editor draft when switching to mobile ${mobile}`, async () => {
    const resize = responsive();
    const view = mount();
    await view.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter hasMemory>
          <DataTable
            details={{}}
            getFormConfig={() => form}
            getTableActions={() => ({
              update: async () => ({ success: true }),
            })}
            getTableConfig={() => configuration({ desktop: "drawer", mobile })}
            initialData={[row]}
            queryClient={view.client}
            tableType="records"
          />
        </NuqsTestingAdapter>
      </Provider>
    );
    await act(async () => {
      view.host.querySelector<HTMLTableCellElement>("tbody td")?.click();
      await settle();
    });
    await act(async () => {
      button("Edit").click();
      await settle();
    });
    const input = await fill("Preserved embedded draft");
    await resize(true);
    expect(document.querySelector(".yayaw-record-body input")).toBe(input);
    expect(input.value).toBe("Preserved embedded draft");
    expect(
      document
        .querySelector(".yayaw-record-surface")
        ?.getAttribute("data-presentation")
    ).toBe(mobile);
    await resize(false);
    expect(document.querySelector(".yayaw-record-body input")).toBe(input);
    expect(input.value).toBe("Preserved embedded draft");
  });
}
