import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import type { TableView } from "../src/components/ui/yayaw-table/types/view-types";
import type { DataDestinationContext } from "../src/components/ui/yayaw-table/utils/data-destinations";
import type { ExportFileRequest } from "../src/components/ui/yayaw-table/utils/export-model";

// The Export screen and the bulk CSV, as `packages/yayaw-table-vue/src/
// components/export-screen.test.ts` checks them in Vue: `enableExport: false`
// columns never leave, "Choose columns" writes the checked ones in display
// order, the active saved view names the file, the labels speak French, and
// the bulk CSV is safe and uses `table.exportCsvSeparator`.

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
  createdById: "me",
  config: {},
};

const configFor = (table: Record<string, unknown> = {}) =>
  defineTableConfig({
    id: TABLE_ID,
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        // Visible, yet never exported.
        { id: "secret", header: "Secret", type: "text", enableExport: false },
        { id: "amount", header: "Amount", type: "number" },
        { id: "paid", header: "Paid", type: "boolean" },
      ],
      visible: ["select", "name", "secret", "amount"],
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

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
});

const settle = async (frames = 6): Promise<void> => {
  if (frames === 0) {
    return;
  }
  await act(() => new Promise((resolve) => setTimeout(resolve, 40)));
  await settle(frames - 1);
};

async function openTable({
  locale,
  table,
  exportFile = true,
}: {
  locale?: string;
  table?: Record<string, unknown>;
  exportFile?: boolean;
} = {}) {
  const requests: ExportFileRequest[] = [];
  const sent: DataDestinationContext[] = [];
  const actions: TableActions = {
    list: () =>
      Promise.resolve({ data: rows, meta: { pageCount: 1, totalCount: 2 } }),
    ...(exportFile
      ? {
          exportFile: (request: ExportFileRequest) => {
            requests.push(request);
            return Promise.resolve(undefined);
          },
        }
      : {}),
    destinations: [
      {
        id: "webhook",
        label: "Webhook",
        kind: "connect",
        run: (context: DataDestinationContext) => {
          sent.push(context);
          return { message: "Sent" };
        },
      },
    ],
  };
  const config = configFor(table);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await act(() =>
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter hasMemory>
          <DataTable
            getRowId={(row) => String(row.id)}
            getTableActions={() => actions}
            getTableConfig={() => config}
            initialActiveViewId={activeItems.id}
            initialViews={[activeItems]}
            initialViewsLoaded
            locale={locale}
            queryClient={client}
            tableType={TABLE_ID}
          />
        </NuqsTestingAdapter>
      </Provider>
    )
  );
  await settle();
  return { container, requests, sent };
}

const control = (name: string, selector = "button") => {
  const element = [...document.querySelectorAll<HTMLElement>(selector)].find(
    (item) =>
      item.getAttribute("aria-label") === name ||
      item.textContent?.trim() === name
  );
  if (!element) {
    throw new Error(`Missing control: ${name}`);
  }
  return element;
};
const click = async (name: string, selector?: string) => {
  await act(() => control(name, selector).click());
  await settle(3);
};
const panel = () => {
  const element = document.querySelector<HTMLElement>("[data-export-panel]");
  if (!element) {
    throw new Error("The Export screen is closed");
  }
  return element;
};
const openExport = async (exportLabel = "Export") => {
  await click("Data");
  await click(exportLabel, '[data-menu-section="data"] button');
};
/** Chooses an option of one of the Export screen's selects, as a mouse does. */
const choose = async (field: string, option: string) => {
  const trigger = control(field, '[role="combobox"]');
  await act(() => {
    trigger.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" })
    );
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });
  await settle(3);
  const item = control(option, '[role="option"]');
  // An option is chosen once the pointer highlights it.
  await act(() => {
    item.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
  });
  await act(() => item.click());
  await settle(3);
};
const fileName = () => {
  const label = [...panel().querySelectorAll("label")].find((item) =>
    ["File name", "Nom du fichier"].includes(item.textContent?.trim() ?? "")
  );
  return (document.getElementById(label?.htmlFor ?? "") as HTMLInputElement)
    ?.value;
};
const checklist = () =>
  [
    ...panel().querySelectorAll<HTMLElement>(
      '[data-export-columns] [role="checkbox"]'
    ),
  ].map(
    (box) =>
      `${box.getAttribute("aria-label")}${box.getAttribute("aria-checked") === "true" ? " ✓" : ""}`
  );
const run = async () => {
  const button = [...panel().querySelectorAll("button")].at(-1);
  if (button?.textContent?.trim() !== "Export") {
    throw new Error("Missing the Export button");
  }
  await act(() => button.click());
  await settle(3);
};

it("names the file after the view and never exports `enableExport: false` columns", async () => {
  const { requests } = await openTable();
  await openExport();
  expect(fileName()).toMatch(FILE_NAME);
  await run();
  // Visible columns in display order, without the secret one.
  expect(requests.at(-1)?.columns.map((column) => column.id)).toEqual([
    "amount",
    "name",
  ]);
  await choose("Columns", "All");
  await run();
  expect(requests.at(-1)?.columns.map((column) => column.id)).toEqual([
    "name",
    "amount",
    "paid",
  ]);
});

it("sends Connect destinations the view's columns without `enableExport: false` ones", async () => {
  const { sent } = await openTable();
  await click("Data");
  await click("Connect", '[data-menu-section="data"] button');
  await click("Webhook");
  expect(sent.at(-1)?.columns).toEqual([
    { id: "amount", header: "Amount" },
    { id: "name", header: "Name" },
  ]);
});

it("exports the chosen columns in display order", async () => {
  const { requests } = await openTable();
  await openExport();
  await choose("Columns", "Choose columns");
  // Every exportable column in display order; the visible ones checked.
  expect(checklist()).toEqual(["Amount ✓", "Name ✓", "Paid"]);
  await click("Select none");
  expect(checklist()).toEqual(["Amount", "Name", "Paid"]);
  const exportButton = [...panel().querySelectorAll("button")].at(-1);
  expect(exportButton?.hasAttribute("disabled")).toBe(true);
  expect(panel().textContent).toContain("Choose at least one column.");
  await click("Paid", '[role="checkbox"]');
  await click("Amount", '[role="checkbox"]');
  await run();
  expect(requests.at(-1)?.columns.map((column) => column.id)).toEqual([
    "amount",
    "paid",
  ]);
  await click("Select all");
  expect(checklist()).toEqual(["Amount ✓", "Name ✓", "Paid ✓"]);
});

it("labels the Export screen in French", async () => {
  await openTable({ locale: "fr-FR" });
  await openExport("Export");
  const text = panel().textContent ?? "";
  for (const label of [
    "Enregistrements",
    "Colonnes",
    "Valeurs",
    "Nom du fichier",
  ]) {
    expect(text).toContain(label);
  }
  await choose("Colonnes", "Choisir les colonnes");
  expect(panel().textContent).toContain("Tout cocher");
});

it("offers Excel without a server once `table.excelWriter` is set", async () => {
  const written: { headers: string[]; sheetName: string }[] = [];
  const excelWriter = (
    matrix: { headers: string[] },
    { sheetName }: { sheetName: string }
  ) => {
    written.push({ headers: matrix.headers, sheetName });
    return new Blob(["xlsx"]);
  };
  const createObjectURL = URL.createObjectURL;
  URL.createObjectURL = () => "blob:excel";
  const links = Object.getPrototypeOf(document.createElement("a")) as {
    click: () => void;
  };
  const follow = links.click;
  links.click = () => undefined;
  try {
    // The host has no `exportFile`: the Excel item writes the file here.
    const { requests } = await openTable({
      table: { excelWriter },
      exportFile: false,
    });
    await openExport();
    await choose("Format", "Excel (.xlsx)");
    await run();
    expect(requests).toEqual([]);
    expect(written).toEqual([
      { headers: ["Amount", "Name"], sheetName: "Projects" },
    ]);
  } finally {
    URL.createObjectURL = createObjectURL;
    links.click = follow;
  }
});

it("writes a safe bulk CSV with the configured separator, without `enableExport: false` columns", async () => {
  const files: Blob[] = [];
  const createObjectURL = URL.createObjectURL;
  const revokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = (file: Blob) => {
    files.push(file);
    return "blob:export";
  };
  URL.revokeObjectURL = () => undefined;
  // The DOM would follow the download link.
  const links = Object.getPrototypeOf(document.createElement("a")) as {
    click: () => void;
  };
  const follow = links.click;
  links.click = () => undefined;
  try {
    const { container } = await openTable({
      table: { export: false, exportCsvSeparator: ";" },
    });
    const boxes = container.querySelectorAll<HTMLElement>(
      'tbody [role="checkbox"]'
    );
    await act(() => boxes[0]?.click());
    await act(() => boxes[1]?.click());
    await settle(2);
    await click("Export");
    const [file] = files;
    expect(file).toBeDefined();
    const bytes = new Uint8Array(await (file as Blob).arrayBuffer());
    expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes)).toBe(
      "﻿Amount;Name\n-12;'=HYPERLINK(1)\n5;Bravo"
    );
  } finally {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    links.click = follow;
  }
});
