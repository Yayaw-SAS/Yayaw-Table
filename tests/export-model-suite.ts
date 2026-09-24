import assert from "node:assert/strict";
import type * as Model from "../src/components/ui/yayaw-table/utils/export-model";

const columns = [
  { id: "name", header: "Name", type: "text" },
  {
    id: "status",
    header: "Status",
    type: "select",
    options: [{ value: "a", label: "Active" }],
  },
  {
    id: "price",
    header: "Price",
    type: "number",
    numberFormat: { currency: "EUR", locale: "en-US" },
  },
];
const rows = [{ id: "1", name: 'Say "hi", <b>', status: "a", price: 12 }];
const settings = {
  format: "csv" as const,
  scope: "view" as const,
  columns: "visible" as const,
  values: "formatted" as const,
  fileName: "projects",
};
const query = {
  search: "",
  filters: {},
  advancedFilters: [],
  advancedFilterJoin: "and" as const,
  sorting: [],
};

export function exportModelSuite(
  test: (name: string, body: () => void | Promise<void>) => void,
  model: Pick<
    typeof Model,
    | "availableExportFormats"
    | "csvFromMatrix"
    | "defaultExportFileName"
    | "exportFileName"
    | "exportMatrix"
    | "printableHtml"
    | "runExport"
  >
) {
  test("names files after the table, the view and the day", () => {
    assert.equal(
      model.defaultExportFileName(
        "Projets été",
        "Active items",
        new Date(2026, 8, 3)
      ),
      "projets-ete-active-items-2026-09-03"
    );
    assert.equal(
      model.exportFileName({ ...settings, format: "pdf" }),
      "projects.pdf"
    );
    assert.equal(
      model.exportFileName({ ...settings, fileName: "report.csv" }),
      "report.csv"
    );
  });

  test("writes values as displayed or as stored", () => {
    assert.deepEqual(
      model.exportMatrix(rows, columns, { formatted: true, locale: "en-US" })
        .rows,
      [['Say "hi", <b>', "Active", "€12.00"]]
    );
    assert.deepEqual(
      model.exportMatrix(rows, columns, { formatted: false }).rows,
      [['Say "hi", <b>', "a", 12]]
    );
  });

  test("escapes CSV cells and HTML", () => {
    const matrix = model.exportMatrix(rows, columns, { formatted: false });
    const csv = model.csvFromMatrix(matrix);
    assert.ok(csv.startsWith("﻿Name,Status,Price\n"));
    assert.ok(csv.endsWith('"Say ""hi"", <b>",a,12'));
    const html = model.printableHtml({ title: "A & B", matrix });
    assert.ok(html.includes("<title>A &amp; B</title>"));
    assert.ok(html.includes("Say &quot;hi&quot;, &lt;b&gt;"));
  });

  test("offers Excel only with a writer, within the configured formats", () => {
    assert.deepEqual(model.availableExportFormats(undefined, false), [
      "csv",
      "pdf",
    ]);
    assert.deepEqual(model.availableExportFormats(["xlsx", "csv"], true), [
      "csv",
      "xlsx",
    ]);
  });

  test("lets the server build the file, otherwise writes it here", async () => {
    const downloads: [unknown, string][] = [];
    const base = {
      settings,
      viewId: "v1",
      query,
      allColumns: columns,
      visibleColumns: columns.slice(0, 1),
      selectedRowIds: ["1"],
      selectedRows: rows,
      loadRows: () => Promise.resolve(rows),
      title: "Projects",
      download: (file: unknown, name: string) => downloads.push([file, name]),
      print: () => undefined,
    };
    const requests: unknown[] = [];
    await model.runExport({
      ...base,
      settings: { ...settings, format: "xlsx", scope: "selection" },
      exportFile: (request) => {
        requests.push(request);
        return Promise.resolve({ url: "https://files.test/p.xlsx" });
      },
    });
    assert.deepEqual(requests, [
      {
        format: "xlsx",
        scope: "selection",
        formatted: true,
        fileName: "projects.xlsx",
        viewId: "v1",
        query,
        // Formats travel with each column, so the server can match "formatted".
        columns: [{ id: "name", header: "Name", type: "text" }],
        selectedRowIds: ["1"],
      },
    ]);
    assert.deepEqual(downloads.at(-1), [
      "https://files.test/p.xlsx",
      "projects.xlsx",
    ]);

    let printed = "";
    await model.runExport({
      ...base,
      settings: { ...settings, format: "pdf", columns: "all" },
      print: (html) => {
        printed = html;
      },
    });
    assert.ok(printed.includes("<th>Price</th>"));
    assert.ok(printed.includes("1 record"));

    let delivered: unknown[] = [];
    await model.runExport({
      ...base,
      onRows: (list) => {
        delivered = list;
      },
    });
    assert.equal(delivered.length, 1);
  });
}
