import assert from "node:assert/strict";
import type * as Flow from "../src/components/ui/yayaw-table/utils/import-flow";
import type * as Model from "../src/components/ui/yayaw-table/utils/import-model";

export type ImportModel = Pick<
  typeof Model,
  | "IMPORT_IGNORE"
  | "coerceImportValue"
  | "decodeCsvFile"
  | "defaultImportKey"
  | "defaultImportMapping"
  | "detectCsvDelimiter"
  | "detectDateOrder"
  | "existingLookupFromRows"
  | "importBatches"
  | "importFields"
  | "isImportAuthError"
  | "parseCsv"
  | "planImport"
  | "runImport"
  | "summarizeImport"
> &
  Pick<
    typeof Flow,
    | "IMPORT_NO_KEY"
    | "applyImportField"
    | "canRunImport"
    | "createImportFlow"
    | "describeImportResult"
    | "importColumnsFrom"
    | "importErrorLines"
    | "importFailureLines"
    | "importLabels"
    | "importMappingRows"
    | "importPreview"
    | "importSettingsFields"
    | "importSummaryLines"
    | "isImportEnabled"
  >;

type Column = Model.ImportColumn;

const options = (values: string[]) =>
  values.map((value) => ({ value: value.toLowerCase(), label: value }));

const columns: Column[] = [
  { id: "name", header: "Name", type: "text", required: true },
  {
    id: "status",
    header: "Status",
    type: "select",
    options: options(["Active", "Draft", "Archived"]),
  },
  {
    id: "tags",
    header: "Tags",
    type: "multiSelect",
    options: options(["Red", "Green", "Été"]),
  },
  { id: "price", header: "Price", type: "number" },
  {
    id: "progress",
    header: "Progress",
    type: "number",
    numberFormat: { style: "percent" },
  },
  { id: "due", header: "Due date", type: "date" },
  { id: "done", header: "Done", type: "boolean" },
  { id: "site", header: "Website", type: "url" },
  { id: "mail", header: "Email", type: "email" },
  { id: "meta", header: "Meta", type: "json" },
];

const column = (id: string): Column => {
  const found = columns.find((item) => item.id === id);
  if (!found) {
    throw new Error(`No column ${id}`);
  }
  return found;
};

const value = (result: Model.ImportValueResult) => {
  if (!("value" in result)) {
    throw new Error(`Expected a value, got ${result.error}`);
  }
  return result.value;
};

const error = (result: Model.ImportValueResult) => {
  if (!("error" in result)) {
    throw new Error(`Expected an error, got ${JSON.stringify(result.value)}`);
  }
  return result.error;
};

const FIXTURE = [
  "Name;Catégorie;Status;Price;Échéance;Progress;Notes",
  "Golf rollout;Software;Active;1 234,50 €;03/10/2026;50 %;x",
  'Hôtel booking;Service;Draft;89,90;15/10/2026;;"multi',
  'line"',
  "Alpha launch;Software;Archived;59;02/09/2026;25 %;",
  "India pilot;Hardware;Paused;250;20/10/2026;;",
  "Golf rollout;Software;Draft;10;04/10/2026;;",
  "",
].join("\r\n");

const demoColumns: Column[] = [
  { id: "name", header: "Name", type: "text" },
  {
    id: "category",
    header: "Category",
    type: "select",
    options: [
      { value: "Software", label: "Software" },
      { value: "Hardware", label: "Hardware" },
      { value: "Service", label: "Service" },
    ],
  },
  {
    id: "status",
    header: "Status",
    type: "select",
    options: [
      { value: "Active", label: "Active" },
      { value: "Draft", label: "Draft" },
      { value: "Archived", label: "Archived" },
    ],
  },
  { id: "price", header: "Price", type: "number" },
  {
    id: "progress",
    header: "Progress",
    type: "number",
    numberFormat: { style: "percent" },
  },
  { id: "dueDate", header: "Due", type: "date" },
];

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The import model and flow, run by the React and Vue test runners. */
export function importModelSuite(
  test: (name: string, body: () => void | Promise<void>) => void,
  model: ImportModel
) {
  const en = model.importLabels("en");

  test("parses RFC 4180 CSV: quotes, escaped quotes, newlines, CRLF and BOM", () => {
    const parsed = model.parseCsv(
      '\uFEFFname,note\r\n"Smith, J","He said ""hi"""\r\nDoe,"two\nlines"\r\n\r\n'
    );
    assert.deepEqual(parsed, {
      headers: ["name", "note"],
      rows: [
        ["Smith, J", 'He said "hi"'],
        ["Doe", "two\nlines"],
      ],
      delimiter: ",",
    });
  });

  test("detects comma, semicolon, tab and pipe delimiters", () => {
    assert.equal(model.detectCsvDelimiter("a,b,c\n1,2,3"), ",");
    assert.equal(model.detectCsvDelimiter("a;b;c\n1,5;2;3"), ";");
    assert.equal(model.detectCsvDelimiter("a\tb\n1\t2"), "\t");
    assert.equal(model.detectCsvDelimiter("a|b|c\n1|2|3"), "|");
    assert.equal(model.detectCsvDelimiter('"x;y",b\n"1;2",3'), ",");
    assert.equal(model.detectCsvDelimiter("single"), ",");
  });

  test("pads short rows, names missing headers and reads headerless files", () => {
    const parsed = model.parseCsv("a,,c\n1\n", { delimiter: "," });
    assert.deepEqual(parsed.headers, ["a", "Column 2", "c"]);
    assert.deepEqual(parsed.rows, [["1", "", ""]]);
    const bare = model.parseCsv("1;2\n3;4", { headers: false });
    assert.deepEqual(bare.headers, ["Column 1", "Column 2"]);
    assert.equal(bare.rows.length, 2);
    assert.equal(bare.delimiter, ";");
  });

  test("decodes UTF-8 and falls back to windows-1252", () => {
    const utf8 = new TextEncoder().encode("Échéance;Prix");
    assert.equal(model.decodeCsvFile(utf8), "Échéance;Prix");
    const latin = new Uint8Array([0xc9, 0x74, 0xe9, 0x3b, 0x80]);
    assert.equal(model.decodeCsvFile(latin.buffer), "Été;€");
  });

  test("converts numbers with decimal commas, grouping, currencies and percents", () => {
    const price = column("price");
    assert.equal(value(model.coerceImportValue("1 234,50 €", price)), 1234.5);
    assert.equal(value(model.coerceImportValue("$1,234.50", price)), 1234.5);
    assert.equal(value(model.coerceImportValue("1.234.567", price)), 1_234_567);
    assert.equal(value(model.coerceImportValue("89,90", price)), 89.9);
    assert.equal(value(model.coerceImportValue("1,234", price)), 1234);
    assert.equal(
      value(model.coerceImportValue("1,234", price, { locale: "fr-FR" })),
      1.234
    );
    assert.equal(value(model.coerceImportValue("(12.5)", price)), -12.5);
    assert.equal(value(model.coerceImportValue("-3", price)), -3);
    assert.equal(value(model.coerceImportValue("1.5e3", price)), 1500);
    assert.equal(value(model.coerceImportValue("CHF 1'200", price)), 1200);
    assert.equal(
      value(model.coerceImportValue("50 %", column("progress"))),
      0.5
    );
    assert.equal(
      value(model.coerceImportValue("0.25", column("progress"))),
      0.25
    );
    const whole = {
      ...column("progress"),
      numberFormat: { style: "percent", percentBase: "whole" },
    };
    assert.equal(value(model.coerceImportValue("50%", whole)), 50);
    const configured = { ...price, numberFormat: { decimalSeparator: "," } };
    assert.equal(value(model.coerceImportValue("1,234", configured)), 1.234);
    assert.equal(
      error(model.coerceImportValue("abc", price)),
      "invalid_number"
    );
    assert.equal(
      error(model.coerceImportValue("1-2", price)),
      "invalid_number"
    );
  });

  test("converts ISO, day-first, month-first and Excel dates", () => {
    const due = column("due");
    assert.equal(
      value(model.coerceImportValue("2026-09-23", due)),
      "2026-09-23"
    );
    assert.equal(
      value(model.coerceImportValue("03/10/2026", due, { dateOrder: "dmy" })),
      "2026-10-03"
    );
    assert.equal(
      value(model.coerceImportValue("03/10/2026", due, { dateOrder: "mdy" })),
      "2026-03-10"
    );
    assert.equal(
      value(model.coerceImportValue("3.10.26", due, { dateOrder: "dmy" })),
      "2026-10-03"
    );
    assert.equal(value(model.coerceImportValue("46288", due)), "2026-09-23");
    assert.equal(
      value(model.coerceImportValue("2026-09-23 14:30", due)),
      "2026-09-23T14:30:00"
    );
    const datetime = { ...due, type: "datetime" };
    assert.equal(
      value(model.coerceImportValue("2026-09-23", datetime)),
      "2026-09-23T00:00:00"
    );
    assert.equal(
      value(model.coerceImportValue("2026-09-23T12:00:00Z", datetime)),
      "2026-09-23T12:00:00.000Z"
    );
    assert.equal(
      error(model.coerceImportValue("31/02/2026", due)),
      "invalid_date"
    );
    assert.equal(error(model.coerceImportValue("soon", due)), "invalid_date");
  });

  test("detects day or month first from the whole column, else from the locale", () => {
    assert.equal(model.detectDateOrder(["03/10/2026", "15/10/2026"]), "dmy");
    assert.equal(
      model.detectDateOrder(["10/03/2026", "10/15/2026"], "fr"),
      "mdy"
    );
    assert.equal(model.detectDateOrder(["03/10/2026"], "en-US"), "mdy");
    assert.equal(model.detectDateOrder(["03/10/2026"], "fr-FR"), "dmy");
    assert.equal(model.detectDateOrder(["03/10/2026"], "en-GB"), "dmy");
  });

  test("converts checkboxes, options, links, emails, JSON and empty cells", () => {
    const done = column("done");
    for (const word of ["true", "Yes", "oui", "1", "x", "X"]) {
      assert.equal(value(model.coerceImportValue(word, done)), true);
    }
    for (const word of ["false", "No", "non", "0"]) {
      assert.equal(value(model.coerceImportValue(word, done)), false);
    }
    assert.equal(
      error(model.coerceImportValue("maybe", done)),
      "invalid_boolean"
    );
    const status = column("status");
    assert.equal(value(model.coerceImportValue("ACTIVE", status)), "active");
    assert.equal(value(model.coerceImportValue("draft", status)), "draft");
    assert.equal(
      error(model.coerceImportValue("Paused", status)),
      "unknown_option"
    );
    assert.equal(
      value(
        model.coerceImportValue("Paused", status, { allowNewOptions: true })
      ),
      "Paused"
    );
    assert.equal(
      value(
        model.coerceImportValue("Paused", { ...status, allowNewOptions: true })
      ),
      "Paused"
    );
    assert.deepEqual(
      value(model.coerceImportValue("red; ETE", column("tags"))),
      ["red", "été"]
    );
    assert.equal(
      error(model.coerceImportValue("red, blue", column("tags"))),
      "unknown_option"
    );
    assert.equal(
      value(model.coerceImportValue("www.yayaw.com", column("site"))),
      "https://www.yayaw.com"
    );
    assert.equal(
      error(model.coerceImportValue("javascript:alert(1)", column("site"))),
      "invalid_url"
    );
    assert.equal(
      error(model.coerceImportValue("nope", column("site"))),
      "invalid_url"
    );
    assert.equal(
      value(model.coerceImportValue("a@b.co", column("mail"))),
      "a@b.co"
    );
    assert.equal(
      error(model.coerceImportValue("a@b", column("mail"))),
      "invalid_email"
    );
    assert.deepEqual(
      value(model.coerceImportValue('{"a":1}', column("meta"))),
      {
        a: 1,
      }
    );
    assert.equal(
      error(model.coerceImportValue("{", column("meta"))),
      "invalid_json"
    );
    assert.equal(value(model.coerceImportValue("  ", column("price"))), null);
    assert.equal(
      error(model.coerceImportValue("", column("name"))),
      "required"
    );
    assert.equal(
      value(model.coerceImportValue(" Alpha ", column("name"))),
      "Alpha"
    );
    assert.equal(
      value(model.coerceImportValue("free", { id: "x", header: "X" })),
      "free"
    );
  });

  test("maps fields by header or id, accents and case ignored, then by samples", () => {
    const parsed = model.parseCsv(FIXTURE);
    const fields = model.importFields(parsed);
    assert.deepEqual(fields[0], {
      name: "Name",
      sample: [
        "Golf rollout",
        "Hôtel booking",
        "Alpha launch",
        "India pilot",
        "Golf rollout",
      ],
    });
    const mapping = model.defaultImportMapping(fields, demoColumns);
    assert.deepEqual(mapping, [
      { field: "Name", columnId: "name" },
      // No name matches: the samples are Category choices.
      { field: "Catégorie", columnId: "category" },
      { field: "Status", columnId: "status" },
      { field: "Price", columnId: "price" },
      // The only date column left.
      { field: "Échéance", columnId: "dueDate" },
      { field: "Progress", columnId: "progress" },
      { field: "Notes", columnId: null },
    ]);
    const byId = model.defaultImportMapping(
      [
        { name: "DUE_DATE", sample: [] },
        { name: "due", sample: ["x"] },
      ],
      [
        { id: "due_date", header: "Deadline", type: "date" },
        { id: "other", header: "Due", type: "text" },
      ]
    );
    assert.deepEqual(byId, [
      { field: "DUE_DATE", columnId: "due_date" },
      { field: "due", columnId: "other" },
    ]);
    // Two same-named columns: the samples' type decides.
    const typed = model.defaultImportMapping(
      [{ name: "Amount", sample: ["12", "3,5"] }],
      [
        { id: "label", header: "Amount", type: "text" },
        { id: "value", header: "amount", type: "number" },
      ]
    );
    assert.deepEqual(typed, [{ field: "Amount", columnId: "value" }]);
    // Ambiguous samples map nothing.
    const ambiguous = model.defaultImportMapping(
      [{ name: "Montant", sample: ["12"] }],
      [
        { id: "a", header: "A", type: "number" },
        { id: "b", header: "B", type: "number" },
      ]
    );
    assert.deepEqual(ambiguous, [{ field: "Montant", columnId: null }]);
    assert.equal(
      model.defaultImportKey(
        [{ field: "ID", columnId: "id" }],
        [{ id: "id", header: "ID" }]
      ),
      "id"
    );
    assert.equal(model.defaultImportKey(mapping, demoColumns), null);
  });

  test("plans creates, updates, errors, duplicate keys and empty rows", () => {
    const parsed = model.parseCsv(`${FIXTURE}\r\n;;;;;;only a note\r\n`);
    const mapping = model.defaultImportMapping(
      model.importFields(parsed),
      demoColumns
    );
    const existing = model.existingLookupFromRows(
      [{ id: "alpha", name: "Alpha launch" }],
      "name",
      (row) => String(row.id)
    );
    const plan = model.planImport({
      rows: parsed.rows,
      fields: parsed.headers,
      mapping,
      columns: demoColumns,
      keyColumnId: "name",
      existing,
    });
    assert.deepEqual(
      plan.creates.map((row) => row.rowIndex),
      [0, 1, 3, 4]
    );
    assert.deepEqual(plan.creates[0], {
      rowIndex: 0,
      values: {
        name: "Golf rollout",
        category: "Software",
        status: "Active",
        price: 1234.5,
        dueDate: "2026-10-03",
        progress: 0.5,
      },
    });
    assert.deepEqual(plan.updates, [
      {
        rowIndex: 2,
        id: "alpha",
        values: {
          name: "Alpha launch",
          category: "Software",
          status: "Archived",
          price: 59,
          dueDate: "2026-09-02",
          progress: 0.25,
        },
      },
    ]);
    assert.deepEqual(plan.errors, [
      {
        rowIndex: 3,
        columnId: "status",
        code: "unknown_option",
        raw: "Paused",
      },
      {
        rowIndex: 4,
        columnId: "name",
        code: "duplicate_key",
        raw: "Golf rollout",
      },
    ]);
    assert.deepEqual(plan.errorRows, [3, 4]);
    assert.deepEqual(plan.skipped, [5]);
    assert.deepEqual(model.summarizeImport(plan, { skipErrors: true }), {
      creates: 2,
      updates: 1,
      errorRows: 2,
      skipped: 1,
    });
    assert.equal(model.summarizeImport(plan, { skipErrors: false }).creates, 4);
  });

  test("required cells fail creates but leave updates unchanged", () => {
    const required: Column[] = [
      { id: "code", header: "Code", type: "text" },
      { id: "title", header: "Title", type: "text", required: true },
    ];
    const plan = model.planImport({
      rows: [
        ["A", ""],
        ["B", ""],
      ],
      fields: ["Code", "Title"],
      mapping: [
        { field: "Code", columnId: "code" },
        { field: "Title", columnId: "title" },
      ],
      columns: required,
      keyColumnId: "code",
      existing: (key) => (key === "A" ? "row-a" : undefined),
    });
    assert.deepEqual(plan.updates, [
      { rowIndex: 0, id: "row-a", values: { code: "A" } },
    ]);
    assert.deepEqual(plan.errors, [
      { rowIndex: 1, columnId: "title", code: "required", raw: "" },
    ]);
  });

  test("runs batches through the host bulk import, with progress", async () => {
    const plan = model.planImport({
      rows: [["a"], ["b"], ["c"]],
      fields: ["Name"],
      mapping: [{ field: "Name", columnId: "name" }],
      columns: [{ id: "name", header: "Name" }],
      keyColumnId: "name",
      existing: (key) => (key === "b" ? "id-b" : undefined),
    });
    assert.deepEqual(
      model
        .importBatches(plan, { batchSize: 2 })
        .map((batch) => [
          batch.creates.map((row) => row.rowIndex),
          batch.updates.map((row) => row.id),
        ]),
      [
        [[0], ["id-b"]],
        [[2], []],
      ]
    );
    const batches: Model.ImportBatch[] = [];
    const progress: number[] = [];
    const result = await model.runImport(
      plan,
      {
        importRows: (batch) => {
          batches.push(batch);
          return {
            created: batch.creates.length,
            updated: batch.updates.length,
            failures: batch.creates.some((row) => row.rowIndex === 2)
              ? [{ rowIndex: 2, message: "Quota" }]
              : [],
          };
        },
        create: () => {
          throw new Error("not used");
        },
      },
      { batchSize: 2, onProgress: ({ done }) => progress.push(done) }
    );
    assert.equal(batches.length, 2);
    assert.deepEqual(progress, [0, 2, 3]);
    assert.deepEqual(result, {
      created: 2,
      updated: 1,
      failed: 1,
      failures: [{ rowIndex: 2, message: "Quota" }],
      aborted: false,
    });
  });

  test("falls back to create and update actions, collecting failures", async () => {
    const plan = model.planImport({
      rows: [["a"], ["b"], ["boom"], ["bad"]],
      fields: ["Name"],
      mapping: [{ field: "Name", columnId: "name" }],
      columns: [{ id: "name", header: "Name" }],
      keyColumnId: "name",
      existing: (key) => (key === "b" ? "id-b" : undefined),
    });
    const created: unknown[] = [];
    const updated: unknown[] = [];
    const result = await model.runImport(plan, {
      create: (values) => {
        if (values.name === "boom") {
          throw new Error("Server down");
        }
        created.push(values);
        return { success: values.name !== "bad", error: "Invalid" };
      },
      update: (id, values) => {
        updated.push([id, values]);
        return { success: true };
      },
    });
    assert.deepEqual(created, [{ name: "a" }, { name: "bad" }]);
    assert.deepEqual(updated, [["id-b", { name: "b" }]]);
    assert.equal(result.created, 1);
    assert.equal(result.updated, 1);
    assert.deepEqual(result.failures, [
      { rowIndex: 2, message: "Server down" },
      { rowIndex: 3, message: "Invalid" },
    ]);
    // Without an update action, updates fail instead of throwing.
    const partial = await model.runImport(plan, {
      create: () => ({ success: true }),
    });
    assert.equal(partial.failed, 1);
  });

  test("a failed bulk batch fails its rows; sign-in errors stop the import", async () => {
    const plan = model.planImport({
      rows: [["a"], ["b"]],
      fields: ["Name"],
      mapping: [{ field: "Name", columnId: "name" }],
      columns: [{ id: "name", header: "Name" }],
    });
    const failed = await model.runImport(plan, {
      importRows: () => {
        throw new Error("Timeout");
      },
    });
    assert.equal(failed.failed, 2);
    assert.equal(failed.failures[0]?.message, "Timeout");
    await assert.rejects(
      model.runImport(plan, {
        create: () => {
          throw Object.assign(new Error("Signed out"), { status: 401 });
        },
      })
    );
    assert.equal(model.isImportAuthError({ code: "forbidden" }), true);
    assert.equal(model.isImportAuthError(new Error("x")), false);
    const controller = new AbortController();
    controller.abort();
    const aborted = await model.runImport(
      plan,
      { create: () => ({ success: true }) },
      { signal: controller.signal }
    );
    assert.equal(aborted.aborted, true);
    assert.equal(aborted.created, 0);
  });

  test("labels are English or French and overridable", () => {
    const fr = model.importLabels("fr-FR");
    assert.equal(en("keyColumn"), "Match existing records by");
    assert.equal(fr("keyColumn"), "Associer aux fiches existantes par");
    assert.equal(fr("creates", { count: 3 }), "3 à ajouter");
    const custom = model.importLabels("en", (key, fallback) =>
      key === "import" ? "Upload" : fallback
    );
    assert.equal(custom("import"), "Upload");
    assert.equal(custom("ignore"), "Ignore");
  });

  test("the mapping screen shows samples, conversion badges, settings and a preview", () => {
    const flow = model.createImportFlow({
      columns: demoColumns,
      locale: "en",
      t: en,
      adapters: {},
      findExisting: () => Promise.resolve(() => undefined),
      onChange: () => undefined,
    });
    flow.loadText(FIXTURE, "projects.csv");
    const { state } = flow;
    assert.equal(state.step, "mapping");
    assert.equal(state.detectedDelimiter, ";");
    assert.equal(state.sourceName, "projects.csv");
    const rows = model.importMappingRows(state, {
      columns: demoColumns,
      locale: "en",
      t: en,
    });
    const status = rows.find((row) => row.label === "Status");
    assert.deepEqual(status?.badge, {
      label: "1 won’t convert",
      invalid: true,
    });
    assert.equal(status?.sample, "e.g. Active");
    assert.equal(status?.value, "status");
    assert.equal(rows[0]?.heading, "Columns");
    assert.deepEqual(rows.find((row) => row.label === "Price")?.badge, {
      label: "Number",
      invalid: false,
    });
    const notes = rows.find((row) => row.label === "Notes");
    assert.equal(notes?.value, model.IMPORT_IGNORE);
    assert.equal(notes?.badge, undefined);
    assert.equal(notes?.options.at(-1)?.label, "Ignore");

    const settings = model.importSettingsFields(state, {
      columns: demoColumns,
      t: en,
    });
    assert.deepEqual(
      settings.map((field) => [field.id, field.value]),
      [
        ["delimiter", "auto"],
        ["key", model.IMPORT_NO_KEY],
      ]
    );
    assert.equal(settings[0]?.options[0]?.label, "Detected: Semicolon");

    const preview = model.importPreview(state, {
      columns: demoColumns,
      locale: "en",
      t: en,
    });
    assert.equal(preview.rows.length, 5);
    assert.equal(preview.columns[0]?.header, "Name");
    const paused = preview.rows[3]?.cells.find(
      (cell) => cell.columnId === "status"
    );
    assert.deepEqual(paused, {
      columnId: "status",
      text: "Paused",
      error: "not one of the options",
    });
    const price = preview.rows[0]?.cells.find(
      (cell) => cell.columnId === "price"
    );
    assert.equal(price?.text, "1234.5");

    model.applyImportField(flow, "map:Progress", model.IMPORT_IGNORE);
    model.applyImportField(flow, "key", "name");
    model.applyImportField(flow, "delimiter", ",");
    assert.equal(flow.state.delimiter, ",");
    // Another separator splits other headers: mapping and key start over.
    assert.notEqual(flow.state.fields.length, 7);
    model.applyImportField(flow, "delimiter", "auto");
    assert.equal(flow.state.fields.length, 7);
  });

  test("the flow maps, reviews, imports and reports", async () => {
    const records = [{ id: "alpha", name: "Alpha launch", status: "Active" }];
    const states: Flow.ImportFlowState[] = [];
    let imported = 0;
    const flow = model.createImportFlow({
      columns: demoColumns,
      locale: "en",
      t: en,
      adapters: {
        create: (values) => {
          records.push({ id: `new-${records.length}`, ...values } as never);
          return { success: true };
        },
        update: (id, values) => {
          Object.assign(records.find((row) => row.id === id) ?? {}, values);
          return { success: true };
        },
      },
      findExisting: (columnId, keys) => {
        assert.deepEqual(keys, [
          "Golf rollout",
          "Hôtel booking",
          "Alpha launch",
          "India pilot",
        ]);
        return Promise.resolve(
          model.existingLookupFromRows(records, columnId, (row) =>
            String(row.id)
          )
        );
      },
      onChange: (state) => states.push(state),
      onImported: () => {
        imported += 1;
      },
    });
    flow.loadText(FIXTURE);
    flow.setField("Progress", model.IMPORT_IGNORE);
    flow.setKey("name");
    await flow.review();
    assert.equal(flow.state.step, "review");
    const plan = flow.state.plan;
    assert.ok(plan);
    assert.deepEqual(model.importSummaryLines(plan, true, en), {
      creates: "2 to add",
      updates: "1 to update",
      errors: "2 rows with errors",
    });
    assert.deepEqual(
      model.importErrorLines(plan, {
        columns: demoColumns,
        t: en,
        hasHeaders: true,
      }),
      [
        "Row 5, Status: not one of the options",
        "Row 6, Name: already in an earlier row",
      ]
    );
    assert.equal(model.canRunImport(plan, true), true);
    assert.equal(model.canRunImport(plan, false), false);
    flow.setSkipErrors(false);
    assert.equal(flow.state.skipErrors, false);
    flow.setSkipErrors(true);
    await flow.run();
    assert.equal(flow.state.step, "result");
    assert.ok(states.some((state) => state.step === "running"));
    const result = flow.state.result;
    assert.ok(result);
    assert.equal(model.describeImportResult(result, en), "2 added, 1 updated");
    assert.equal(imported, 1);
    assert.equal(records.length, 3);
    assert.equal(records[0]?.status, "Archived");
    assert.equal(records[0] && "progress" in records[0], false);

    // The same file again: only updates.
    flow.reset();
    assert.equal(flow.state.step, "source");
    flow.loadText(FIXTURE);
    flow.setKey("name");
    await flow.review();
    assert.deepEqual(
      model.importSummaryLines(flow.state.plan as Model.ImportPlan, true, en),
      { creates: null, updates: "3 to update", errors: "2 rows with errors" }
    );
    await flow.run();
    assert.equal(records.length, 3);
    assert.equal(
      model.describeImportResult(
        flow.state.result as Model.ImportRunResult,
        en
      ),
      "3 updated"
    );
  });

  test("the flow reads files and host sources and steps back", async () => {
    const flow = model.createImportFlow({
      columns: demoColumns,
      locale: "fr",
      t: model.importLabels("fr"),
      adapters: {},
      findExisting: () => Promise.resolve(() => undefined),
      loadSource: (id) =>
        id === "sheet"
          ? Promise.resolve({ name: "Sheet", headers: ["Name"], rows: [["A"]] })
          : Promise.reject(Object.assign(new Error("no"), { status: 403 })),
      onChange: () => undefined,
    });
    await flow.loadFile({
      name: "empty.csv",
      arrayBuffer: () =>
        Promise.resolve(new TextEncoder().encode("a,b\n").buffer),
    });
    assert.equal(flow.state.error, "Aucune ligne dans ce fichier.");
    assert.equal(flow.state.step, "source");
    await flow.loadFile({
      name: "latin.csv",
      arrayBuffer: () =>
        Promise.resolve(
          new Uint8Array([0x4e, 0x61, 0x6d, 0x65, 0x0a, 0xc9, 0x74, 0xe9])
            .buffer
        ),
    });
    assert.deepEqual(flow.state.rows, [["Été"]]);
    flow.back();
    assert.equal(flow.state.step, "source");
    await flow.loadSource("sheet");
    assert.equal(flow.state.step, "mapping");
    assert.equal(flow.state.text, null);
    assert.equal(flow.state.sourceName, "Sheet");
    assert.deepEqual(
      model
        .importSettingsFields(flow.state, { columns: demoColumns, t: en })
        .map((field) => field.id),
      ["key"]
    );
    flow.back();
    await flow.loadSource("private");
    assert.equal(
      flow.state.error,
      "Vous n’êtes pas autorisé à importer dans ce tableau."
    );
    flow.setHasHeaders(false);
    flow.loadText("x;y\n1;2");
    flow.setHasHeaders(false);
    assert.deepEqual(flow.state.headers, ["Column 1", "Column 2"]);
    assert.equal(flow.state.rows.length, 2);
    await tick();
  });

  test("import columns come from the table's definitions; the entry needs a way to write", () => {
    assert.deepEqual(
      model.importColumnsFrom([
        { id: "select", header: "" },
        { id: "name", header: "Name", type: "text", required: true },
        { id: "actions", header: "", type: "actions" },
        { id: "secret", header: "Secret", import: false },
        { id: "status", header: "Status", type: "select", options: [] },
      ]),
      [
        { id: "name", header: "Name", type: "text", required: true },
        { id: "status", header: "Status", type: "select", options: [] },
      ]
    );
    assert.equal(
      model.isImportEnabled({ canCreate: true, canUpdate: false }),
      true
    );
    assert.equal(
      model.isImportEnabled({ flag: false, canCreate: true, canUpdate: true }),
      false
    );
    assert.equal(
      model.isImportEnabled({ canCreate: false, canUpdate: false }),
      false
    );
    assert.deepEqual(
      model.importFailureLines(
        {
          created: 0,
          updated: 0,
          failed: 1,
          failures: [{ rowIndex: 0 }],
          aborted: false,
        },
        { t: en, hasHeaders: true }
      ),
      ["Row 2: could not be saved"]
    );
  });
}
