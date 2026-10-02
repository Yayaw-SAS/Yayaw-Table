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
// Any space but line breaks, the narrow no-break ones of French numbers included.
const SPACES = /[^\S\n]/gu;
const query = {
  search: "",
  filters: {},
  advancedFilters: [],
  advancedFilterJoin: "and" as const,
  sorting: [],
};

/** A downloaded file's text, without its BOM (jsdom's Blob has no `text()`). */
function blobText(file: unknown): Promise<string> {
  if (!(file instanceof Blob)) {
    throw new Error("No file was downloaded");
  }
  if (typeof file.text === "function") {
    return file.text();
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file);
  });
}

export function exportModelSuite(
  test: (name: string, body: () => void | Promise<void>) => void,
  model: Pick<
    typeof Model,
    | "availableExportFormats"
    | "csvFromMatrix"
    | "defaultExportFileName"
    | "exportFileName"
    | "exportLabels"
    | "exportMatrix"
    | "exportRecordCount"
    | "isExportableColumn"
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

  test("leaves out the selection, actions and `enableExport: false` columns", () => {
    const exportable = [
      { id: "select", header: "" },
      { id: "name", header: "Name" },
      { id: "menu", header: "", type: "actions" },
      { id: "secret", header: "Secret", enableExport: false },
      { id: "notes", header: "Notes", enableExport: true },
    ].filter(model.isExportableColumn);
    assert.deepEqual(
      exportable.map((column) => column.id),
      ["name", "notes"]
    );
  });

  test("writes the chosen columns in their order, to the server or here", async () => {
    const requests: Model.ExportFileRequest[] = [];
    const custom = {
      ...settings,
      columns: "custom" as const,
      // Unknown or non-exportable ids are not in `allColumns`: skipped.
      columnIds: ["price", "secret", "name"],
    };
    const base = {
      viewId: null,
      query,
      allColumns: columns,
      visibleColumns: columns,
      selectedRowIds: [],
      selectedRows: rows,
      loadRows: () => Promise.resolve(rows),
      title: "Projects",
      print: () => undefined,
    };
    await model.runExport({
      ...base,
      settings: custom,
      download: () => undefined,
      exportFile: (request) => {
        requests.push(request);
        return Promise.resolve(undefined);
      },
    });
    assert.deepEqual(
      requests[0]?.columns.map((column) => column.id),
      ["price", "name"]
    );
    let file: unknown;
    await model.runExport({
      ...base,
      settings: { ...custom, values: "raw" },
      download: (blob) => {
        file = blob;
      },
    });
    // Read as text, without the BOM.
    assert.equal(await blobText(file), 'Price,Name\n12,"Say ""hi"", <b>"');
  });

  test("neutralizes spreadsheet formulas in text, never in numbers", () => {
    const mixed = [
      { id: "text", header: "Text", type: "text" },
      { id: "amount", header: "Amount", type: "number" },
      {
        id: "french",
        header: "French",
        type: "number",
        numberFormat: { locale: "fr-FR", maximumFractionDigits: 1 },
      },
    ];
    // The data lines, spaces of any kind read as plain spaces.
    const lines = (formatted: boolean, list: Record<string, unknown>[]) =>
      model
        .csvFromMatrix(
          model.exportMatrix(list, mixed, { formatted, locale: "en-US" })
        )
        .replace(SPACES, " ")
        .split("\n")
        .slice(1);
    const formulas = ["=1+1", "+33 6", "-x", "@SUM(A1)", "\tcmd", "\rcmd"];
    assert.deepEqual(
      lines(
        false,
        formulas.map((text) => ({ text }))
      ),
      ["'=1+1,,", "'+33 6,,", "'-x,,", "'@SUM(A1),,", "' cmd,,", '"\' cmd",,']
    );
    // Numbers stay as they are, as displayed ("-12", "1 234,5") or stored,
    // numeric text of number columns too; text that only looks numeric does not.
    assert.deepEqual(
      lines(true, [{ text: "-12", amount: -12, french: 1234.5 }]),
      ['\'-12,-12,"1 234,5"']
    );
    assert.deepEqual(lines(false, [{ text: 5, amount: "-12", french: -3 }]), [
      "5,-12,-3",
    ]);
    // Headers are text.
    assert.ok(
      model
        .csvFromMatrix({ headers: ["=cmd"], rows: [] })
        .startsWith("\uFEFF'=cmd")
    );
  });

  test("separates CSV cells with the configured separator", async () => {
    const matrix = model.exportMatrix(rows, columns, { formatted: false });
    assert.equal(
      model.csvFromMatrix(matrix, ";"),
      '﻿Name;Status;Price\n"Say ""hi"", <b>";a;12'
    );
    assert.equal(
      model.csvFromMatrix(matrix, "\t"),
      '﻿Name\tStatus\tPrice\n"Say ""hi"", <b>"\ta\t12'
    );
    let file: unknown;
    await model.runExport({
      settings: { ...settings, values: "raw" },
      viewId: null,
      query,
      allColumns: columns,
      visibleColumns: columns.slice(0, 1),
      selectedRowIds: [],
      selectedRows: [],
      loadRows: () => Promise.resolve([{ name: "a;b" }]),
      title: "Projects",
      csvSeparator: ";",
      download: (blob) => {
        file = blob;
      },
      print: () => undefined,
    });
    assert.equal(await blobText(file), 'Name\n"a;b"');
  });

  test("writes yes or no as displayed, option labels when the column has them", () => {
    const flags = [
      { id: "paid", header: "Paid", type: "boolean" },
      {
        id: "state",
        header: "State",
        type: "boolean",
        options: [
          { value: true, label: "Open" },
          { value: false, label: "Closed" },
        ],
      },
    ];
    const list = [
      { paid: true, state: true },
      { paid: false, state: false },
      { paid: null, state: null },
    ];
    assert.deepEqual(
      model.exportMatrix(list, flags, { formatted: true, locale: "en-US" })
        .rows,
      [
        ["Yes", "Open"],
        ["No", "Closed"],
        ["", ""],
      ]
    );
    assert.deepEqual(
      model.exportMatrix(list, flags, { formatted: true, locale: "fr-FR" })
        .rows[0],
      ["Oui", "Open"]
    );
    // The host's translations override the built-in labels; raw keeps booleans.
    const labels = model.exportLabels("en", (key, fallback) =>
      key === "yes" ? "Y" : fallback
    );
    assert.deepEqual(
      model.exportMatrix(list, flags, { formatted: true, labels }).rows[0],
      ["Y", "Open"]
    );
    assert.deepEqual(
      model.exportMatrix(list, flags, { formatted: false }).rows[1],
      [false, false]
    );
  });

  test("labels the Export screen in English or French, plural record counts included", () => {
    const en = model.exportLabels("en-US");
    const fr = model.exportLabels("fr-FR");
    assert.equal(en("columnsCustom"), "Choose columns");
    assert.equal(fr("columnsCustom"), "Choisir les colonnes");
    assert.equal(fr("scopeSelection", { count: 3 }), "Sélectionnés (3)");
    assert.equal(model.exportRecordCount(1, en, "en-US"), "1 record");
    assert.equal(model.exportRecordCount(0, en, "en-US"), "0 records");
    assert.equal(model.exportRecordCount(0, fr, "fr-FR"), "0 enregistrement");
    assert.equal(
      model.exportRecordCount(1234, fr, "fr-FR").replace(SPACES, " "),
      "1 234 enregistrements"
    );
  });

  test("counts the printed records in the table locale", async () => {
    let printed = "";
    await model.runExport({
      settings: { ...settings, format: "pdf" },
      viewId: null,
      query,
      allColumns: columns,
      visibleColumns: columns,
      selectedRowIds: [],
      selectedRows: [],
      loadRows: () => Promise.resolve([...rows, ...rows]),
      locale: "fr-FR",
      title: "Projets",
      download: () => undefined,
      print: (html) => {
        printed = html;
      },
    });
    assert.ok(printed.includes("<p>2 enregistrements</p>"));
  });
}
