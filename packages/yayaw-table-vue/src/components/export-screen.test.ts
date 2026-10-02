import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
} from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { inlineTestPortals } from "../../tests/menu-helpers";
import { defineTableConfig } from "../config";
import type { ExportFileRequest } from "../export-model";
import type { TableBehaviorConfig, TableView } from "../types";
import YayawDataTable from "./YayawDataTable.vue";

// The Export screen and the bulk CSV, as `tests/export-screen.test.tsx`
// checks them in React: `enableExport: false` columns never leave, "Choose
// columns" writes the checked ones in display order, the active saved view
// names the file, the labels speak French, and the bulk CSV is safe and uses
// `table.exportCsvSeparator`.

inlineTestPortals();
enableAutoUnmount(afterEach);

const TABLE_ID = "export-screen";
const FILE_NAME = /^projects-active-items-\d{4}-\d{2}-\d{2}$/;
const rows = [
  { id: "1", name: "=HYPERLINK(1)", secret: "s1", amount: -12, paid: true },
  { id: "2", name: "Bravo", secret: "s2", amount: 5, paid: false },
];
const activeItems: TableView = {
  id: "active",
  tableId: TABLE_ID,
  name: "Active items",
  config: {},
};

const mountTable = ({
  locale,
  table,
}: {
  locale?: string;
  table?: Partial<TableBehaviorConfig>;
} = {}) => {
  const requests: ExportFileRequest[] = [];
  const config = defineTableConfig({
    id: TABLE_ID,
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        // Visible, yet never exported.
        { id: "secret", header: "Secret", type: "text", enableExport: false },
        { id: "amount", header: "Amount", type: "number" },
        { id: "paid", header: "Paid", type: "boolean" },
      ],
      visible: ["name", "secret", "amount"],
      mandatory: ["name"],
      order: ["select", "amount", "name", "secret", "paid"],
    },
    table: {
      displayModes: ["table"],
      syncUrl: false,
      viewTabs: false,
      ...table,
    },
    translations: { namespace: TABLE_ID, keys: { title: "Projects" } },
  });
  const wrapper = mount(YayawDataTable, {
    attachTo: document.body,
    props: {
      config,
      data: rows.map((row) => ({ ...row })),
      tableType: TABLE_ID,
      locale,
      initialViews: [activeItems],
      initialActiveViewId: activeItems.id,
      initialViewsLoaded: true,
      syncUrl: false,
      getTableActions: () => ({
        exportFile: (request: ExportFileRequest) => {
          requests.push(request);
          return Promise.resolve(undefined);
        },
      }),
    },
    // Keep Reka selection/focus behavior; jsdom cannot measure popper layout.
    global: {
      stubs: {
        PopperArrow: true,
        PopperContent: { template: "<div><slot /></div>" },
      },
    },
  });
  return { wrapper, requests };
};
type Wrapper = ReturnType<typeof mountTable>["wrapper"];

const body = () => new DOMWrapper(document.body);
const panel = (wrapper: Wrapper) => wrapper.get("[data-export-panel]");
const openExport = async (wrapper: Wrapper, label = "Export") => {
  await flushPromises();
  await wrapper.get(".yayaw-data-trigger").trigger("click");
  await flushPromises();
  const entry = wrapper
    .findAll('[data-menu-section="data"] .yayaw-options-item')
    .find((item) => item.text() === label);
  if (!entry) {
    throw new Error(`Missing Data entry: ${label}`);
  }
  await entry.trigger("click");
  await flushPromises();
};
/** Chooses an option of one of the Export screen's selects. */
const choose = async (wrapper: Wrapper, field: string, option: string) => {
  await wrapper
    .get(`[data-export-panel] [role="combobox"][aria-label="${field}"]`)
    .trigger("keydown", { key: "Enter" });
  await flushPromises();
  const item = body()
    .findAll('[role="option"]')
    .find((element) => element.text() === option);
  if (!item) {
    throw new Error(`Missing option: ${option}`);
  }
  await item.trigger("keydown", { key: "Enter" });
  await flushPromises();
};
const checklist = (wrapper: Wrapper) =>
  panel(wrapper)
    .findAll('[data-export-columns] [role="checkbox"]')
    .map(
      (box) =>
        `${box.attributes("aria-label")}${box.attributes("aria-checked") === "true" ? " ✓" : ""}`
    );
const clickButton = async (wrapper: Wrapper, label: string) => {
  const button = panel(wrapper)
    .findAll("button")
    .find((item) => item.text() === label);
  if (!button) {
    throw new Error(`Missing button: ${label}`);
  }
  await button.trigger("click");
  await flushPromises();
};
const check = async (wrapper: Wrapper, label: string) => {
  await panel(wrapper)
    .get(`[data-export-columns] [role="checkbox"][aria-label="${label}"]`)
    .trigger("click");
  await flushPromises();
};
const run = async (wrapper: Wrapper) => {
  await panel(wrapper).get(".yayaw-export-run").trigger("click");
  await flushPromises();
};

it("names the file after the view and never exports `enableExport: false` columns", async () => {
  const { wrapper, requests } = mountTable();
  await openExport(wrapper);
  expect(
    panel(wrapper).get<HTMLInputElement>(".yayaw-export-name input").element
      .value
  ).toMatch(FILE_NAME);
  await run(wrapper);
  // Visible columns in display order, without the secret one.
  expect(requests.at(-1)?.columns.map((column) => column.id)).toEqual([
    "amount",
    "name",
  ]);
  await choose(wrapper, "Columns", "All");
  await run(wrapper);
  expect(requests.at(-1)?.columns.map((column) => column.id)).toEqual([
    "name",
    "amount",
    "paid",
  ]);
});

it("exports the chosen columns in display order", async () => {
  const { wrapper, requests } = mountTable();
  await openExport(wrapper);
  await choose(wrapper, "Columns", "Choose columns");
  // Every exportable column in display order; the visible ones checked.
  expect(checklist(wrapper)).toEqual(["Amount ✓", "Name ✓", "Paid"]);
  await clickButton(wrapper, "Select none");
  expect(checklist(wrapper)).toEqual(["Amount", "Name", "Paid"]);
  expect(
    panel(wrapper).get(".yayaw-export-run").attributes("disabled")
  ).toBeDefined();
  expect(panel(wrapper).text()).toContain("Choose at least one column.");
  await check(wrapper, "Paid");
  await check(wrapper, "Amount");
  await run(wrapper);
  expect(requests.at(-1)?.columns.map((column) => column.id)).toEqual([
    "amount",
    "paid",
  ]);
  await clickButton(wrapper, "Select all");
  expect(checklist(wrapper)).toEqual(["Amount ✓", "Name ✓", "Paid ✓"]);
});

it("labels the Export screen in French", async () => {
  const { wrapper } = mountTable({ locale: "fr-FR" });
  await openExport(wrapper, "Exporter");
  const text = panel(wrapper).text();
  for (const label of [
    "Enregistrements",
    "Colonnes",
    "Valeurs",
    "Nom du fichier",
  ]) {
    expect(text).toContain(label);
  }
  await choose(wrapper, "Colonnes", "Choisir les colonnes");
  expect(panel(wrapper).text()).toContain("Tout cocher");
});

it("writes a safe bulk CSV with the configured separator, without `enableExport: false` columns", async () => {
  const files: Blob[] = [];
  URL.createObjectURL = vi.fn((file: Blob) => {
    files.push(file);
    return "blob:export";
  });
  URL.revokeObjectURL = vi.fn();
  // jsdom cannot follow the download link.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    () => undefined
  );
  const { wrapper } = mountTable({
    table: { export: false, exportCsvSeparator: ";" },
  });
  await flushPromises();
  for (const box of wrapper
    .findAll('tbody input[type="checkbox"]')
    .slice(0, 2)) {
    await box.setValue(true);
  }
  await wrapper.get('.yayaw-bulk-bar [aria-label="Export"]').trigger("click");
  await flushPromises();
  const [file] = files;
  expect(file).toBeDefined();
  const text = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(
        new TextDecoder("utf-8", { ignoreBOM: true }).decode(
          reader.result as ArrayBuffer
        )
      );
    reader.readAsArrayBuffer(file as Blob);
  });
  expect(text).toBe("﻿Amount;Name\n-12;'=HYPERLINK(1)\n5;Bravo");
});
