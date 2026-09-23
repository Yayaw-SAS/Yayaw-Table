import assert from "node:assert/strict";
import type * as Flow from "../src/components/ui/yayaw-table/utils/connector-flow";
import type * as Schema from "../src/components/ui/yayaw-table/utils/connector-schema";

type ConnectorSchemaApi = Pick<
  typeof Schema,
  | "checkTargetSchema"
  | "invalidSamples"
  | "keyIndexShift"
  | "notionColorFor"
  | "resolveMappedField"
  | "schemaBlocksRun"
  | "schemaRenames"
  | "typeCompatibility"
  | "upgradeMapping"
> &
  Pick<
    typeof Flow,
    | "CONNECTOR_NEW_TARGET"
    | "CONNECTOR_SKIP"
    | "applyConnectorField"
    | "connectorFieldOptions"
    | "connectorLabels"
    | "connectorRenames"
    | "connectorScreenFields"
    | "createConnectorFlow"
    | "describeSchemaFixes"
    | "describeSchemaReport"
    | "resolveConnectorSettings"
    | "schemaIssueMessage"
    | "toConnectorMapping"
  >;

/** The table's columns, with their types and options. */
const columns = [
  { id: "name", header: "Name", type: "text", visible: true },
  {
    id: "category",
    header: "Category",
    type: "select",
    visible: true,
    options: [
      { value: "Software", label: "Software" },
      { value: "Hardware", label: "Hardware", color: "red" },
      "Service",
    ],
  },
  {
    id: "status",
    header: "Status",
    type: "select",
    visible: true,
    options: ["Active", "Draft"],
  },
  { id: "price", header: "Price", type: "number", visible: true },
  { id: "progress", header: "Progress", type: "number", visible: true },
  { id: "due", header: "Due", type: "date", visible: true },
];

/** A Notion database that drifted: "Price" became "Cost", "Progress" a select. */
const notionFields = [
  { name: "Name", id: "title", type: "title" },
  { name: "Category", id: "cat", type: "select", options: ["Software"] },
  { name: "Status", id: "sts", type: "status", options: ["Active", "Draft"] },
  { name: "Cost", id: "prc", type: "number" },
  { name: "Progress", id: "prg", type: "select", options: ["Done"] },
  { name: "Due", id: "due", type: "date" },
  { name: "Margin", id: "mrg", type: "formula" },
  { name: "Owner", id: "own", type: "people" },
];

const savedMapping = [
  { columnId: "name", field: "Name", fieldId: "title" },
  { columnId: "category", field: "Category", fieldId: "cat" },
  { columnId: "status", field: "Status", fieldId: "sts" },
  { columnId: "price", field: "Price", fieldId: "prc" },
  { columnId: "progress", field: "Progress", fieldId: "prg" },
  { columnId: "due", field: "Due", fieldId: "due" },
];

const notion = { provider: "notion" as const, fields: notionFields };

const codes = (report: Schema.SchemaReport) =>
  report.issues.map(
    (issue) =>
      `${issue.severity}:${issue.code}:${issue.columnId ?? issue.field}`
  );

const pushResult = () => ({
  created: 1,
  updated: 0,
  skipped: 0,
  failed: 0,
  failures: [],
  warnings: [],
  warningCount: 0,
  truncated: false,
});

/** Target check, field identity, "Prepare" and the screen, run by the React and Vue test runners. */
export function connectorSchemaSuite(
  test: (name: string, body: () => void | Promise<void>) => void,
  api: ConnectorSchemaApi
) {
  const en = api.connectorLabels("en");
  const fr = api.connectorLabels("fr");

  test("type compatibility matrix per direction", () => {
    const rows: [
      string | undefined,
      string | undefined,
      string,
      string,
      string,
    ][] = [
      ["text", "rich_text", "ok", "ok", "ok"],
      ["text", "title", "ok", "ok", "ok"],
      ["text", "number", "coerce", "ok", "coerce"],
      ["text", "select", "coerce", "ok", "coerce"],
      ["number", "number", "ok", "ok", "ok"],
      ["number", "rich_text", "ok", "coerce", "coerce"],
      ["number", "select", "no", "no", "no"],
      ["currency", "number", "ok", "ok", "ok"],
      ["select", "select", "ok", "ok", "ok"],
      ["select", "status", "ok", "ok", "ok"],
      ["select", "multi_select", "ok", "no", "no"],
      ["multiSelect", "multi_select", "ok", "ok", "ok"],
      ["multiSelect", "select", "no", "ok", "no"],
      ["date", "date", "ok", "ok", "ok"],
      ["date", "created_time", "read_only", "coerce", "read_only"],
      ["boolean", "checkbox", "ok", "ok", "ok"],
      ["boolean", "number", "no", "no", "no"],
      ["url", "url", "ok", "ok", "ok"],
      ["email", "email", "ok", "ok", "ok"],
      ["phone", "phone_number", "ok", "ok", "ok"],
      ["number", "formula", "read_only", "coerce", "read_only"],
      ["text", "rollup", "read_only", "ok", "read_only"],
      ["text", "people", "unsupported", "unsupported", "unsupported"],
      ["text", "relation", "unsupported", "unsupported", "unsupported"],
      ["url", "files", "unsupported", "unsupported", "unsupported"],
      ["number", undefined, "ok", "ok", "ok"],
      [undefined, "number", "coerce", "ok", "coerce"],
      // Sheets: types sampled from cells.
      ["number", "text", "ok", "coerce", "coerce"],
      ["date", "boolean", "no", "no", "no"],
    ];
    for (const [column, target, push, pull, twoWay] of rows) {
      const label = `${column} / ${target}`;
      assert.equal(api.typeCompatibility(column, target, "push"), push, label);
      assert.equal(api.typeCompatibility(column, target, "pull"), pull, label);
      assert.equal(
        api.typeCompatibility(column, target, "two-way"),
        twoWay,
        label
      );
    }
  });

  test("push: every issue code with its severity", () => {
    const report = api.checkTargetSchema({
      columns: [
        ...columns,
        { id: "margin", header: "Margin", type: "number" },
        { id: "owner", header: "Owner", type: "text" },
        { id: "notes", header: "Notes", type: "text" },
        { id: "old", header: "Old", type: "text" },
        { id: "copy", header: "Copy", type: "text" },
      ],
      mapping: [
        ...savedMapping.filter((entry) => entry.columnId !== "name"),
        { columnId: "margin", field: "Margin", fieldId: "mrg" },
        { columnId: "owner", field: "Owner", fieldId: "own" },
        { columnId: "notes", field: "Notes" },
        { columnId: "old", field: "Old", fieldId: "gone" },
        { columnId: "copy", field: "Due" },
      ],
      targetSchema: notion,
      direction: "push",
    });
    assert.deepEqual(codes(report), [
      "blocking:incompatible_type:progress",
      "blocking:read_only_field:margin",
      "blocking:unsupported_type:owner",
      "blocking:duplicate_mapping:due",
      "blocking:duplicate_mapping:copy",
      "blocking:title_unmapped:Name",
      "fixable:missing_options:category",
      "fixable:missing_field:notes",
      "fixable:deleted_field:old",
      "fixable:missing_key:Yayaw ID",
      "warning:renamed_field:price",
      "warning:coercible_type:copy",
    ]);
    assert.equal(api.schemaBlocksRun(report), true);
    assert.deepEqual(report.fixes, [
      {
        kind: "add_options",
        field: "Category",
        fieldId: "cat",
        type: "select",
        options: [
          { name: "Hardware", color: "red" },
          { name: "Service", color: api.notionColorFor({ value: "Service" }) },
        ],
      },
      {
        kind: "create_field",
        field: "Notes",
        type: "rich_text",
        columnId: "notes",
      },
      {
        kind: "create_field",
        field: "Old",
        type: "rich_text",
        columnId: "old",
      },
      { kind: "create_field", field: "Yayaw ID", type: "rich_text", key: true },
    ]);
    assert.deepEqual(api.schemaRenames(report), [
      { columnId: "price", from: "Price", to: "Cost" },
    ]);
  });

  test("status options cannot be added through Notion's API: they block", () => {
    const report = api.checkTargetSchema({
      columns,
      mapping: [{ columnId: "status", field: "Status" }],
      targetSchema: {
        provider: "notion",
        fields: [
          { name: "Name", type: "title" },
          { name: "Status", type: "status", options: ["Active"] },
          { name: "Yayaw ID", type: "rich_text" },
        ],
      },
    });
    assert.deepEqual(codes(report), [
      "blocking:missing_options:status",
      "blocking:title_unmapped:Name",
    ]);
    assert.deepEqual(report.fixes, []);
    assert.equal(
      api.schemaIssueMessage(report.issues[0] as Schema.SchemaIssue, {
        t: en,
        target: "Notion",
        columns,
      }),
      "Status: 1 status options missing in Notion: Draft. Add them in Notion, then check again."
    );
  });

  test("pull and two-way: read-only fields are fine to read, text that won't convert blocks", () => {
    const fields = [
      { name: "Name", type: "title" },
      { name: "Yayaw ID", type: "rich_text" },
      { name: "Margin", type: "formula" },
      { name: "Amount", type: "rich_text", sample: ["12", "n/a", ""] },
      { name: "Count", type: "rich_text", sample: ["12", "3.5"] },
    ];
    const input = {
      columns: [
        { id: "name", header: "Name", type: "text" },
        { id: "margin", header: "Margin", type: "number" },
        { id: "amount", header: "Amount", type: "number" },
        { id: "count", header: "Count", type: "number" },
        { id: "notes", header: "Notes", type: "text" },
      ],
      mapping: [
        { columnId: "name", field: "Name" },
        { columnId: "margin", field: "Margin" },
        { columnId: "amount", field: "Amount" },
        { columnId: "count", field: "Count" },
        { columnId: "notes", field: "Notes" },
      ],
      targetSchema: { provider: "notion" as const, fields },
    };
    const pull = api.checkTargetSchema({ ...input, direction: "pull" });
    assert.deepEqual(codes(pull), [
      "blocking:incompatible_type:amount",
      "warning:coercible_type:margin",
      "warning:coercible_type:count",
      "warning:missing_field:notes",
    ]);
    assert.equal(pull.issues[0]?.detail.invalid, 1);
    assert.equal(
      api.schemaIssueMessage(pull.issues[0] as Schema.SchemaIssue, {
        t: en,
        target: "Notion",
        columns: input.columns,
      }),
      "Amount: 1 values in Notion won’t convert to Number."
    );
    const twoWay = api.checkTargetSchema({ ...input, direction: "two-way" });
    assert.deepEqual(codes(twoWay), [
      "blocking:read_only_field:margin",
      "blocking:incompatible_type:amount",
      "fixable:missing_field:notes",
      "warning:coercible_type:count",
    ]);
    // Sheets cells take anything: a sampled type is only a warning.
    const sheets = api.checkTargetSchema({
      ...input,
      targetSchema: { provider: "sheets", fields },
      direction: "pull",
    });
    assert.equal(api.schemaBlocksRun(sheets), false);
  });

  test("key field: missing is fixable, a type that cannot hold ids blocks", () => {
    const check = (type: string, provider: "notion" | "sheets" = "notion") =>
      codes(
        api.checkTargetSchema({
          columns,
          mapping: [{ columnId: "name", field: "Name" }],
          keyField: "Yayaw ID",
          targetSchema: {
            provider,
            fields: [
              { name: "Name", type: "title" },
              { name: "Yayaw ID", type },
            ],
          },
        })
      );
    assert.deepEqual(check("rich_text"), []);
    assert.deepEqual(check("number"), []);
    assert.deepEqual(check("checkbox"), ["blocking:key_wrong_type:Yayaw ID"]);
    assert.deepEqual(check("boolean", "sheets"), [
      "warning:key_wrong_type:Yayaw ID",
    ]);
    // The title can be the key: no column is needed for it then.
    assert.deepEqual(
      codes(
        api.checkTargetSchema({
          columns,
          mapping: [{ columnId: "price", field: "Cost" }],
          keyField: "Name",
          targetSchema: notion,
        })
      ),
      []
    );
  });

  test("a target without a provider leaves new fields and the key to the push", () => {
    const report = api.checkTargetSchema({
      columns,
      mapping: [
        { columnId: "name", field: "Name" },
        { columnId: "price", field: "Price" },
      ],
      targetSchema: { fields: [{ name: "Name" }] },
    });
    assert.deepEqual(report, { issues: [], fixes: [] });
  });

  test("fields are found by id, then name, then (sheets) shifted position", () => {
    const fields = [
      { name: "Yayaw ID", index: 1 },
      { name: "Name", index: 2 },
      { name: "Due date", index: 5 },
    ];
    assert.deepEqual(
      api.resolveMappedField(
        { columnId: "price", field: "Price", fieldId: "prc" },
        notionFields
      ),
      { status: "renamed", field: notionFields[3], from: "Price" }
    );
    assert.equal(
      api.resolveMappedField(
        { columnId: "x", field: "Gone", fieldId: "zz" },
        notionFields
      ).status,
      "deleted"
    );
    assert.equal(
      api.resolveMappedField({ columnId: "x", field: "Gone" }, notionFields)
        .status,
      "missing"
    );
    // The key column moved from A to B: every saved position moves with it.
    const shift = api.keyIndexShift(fields, "Yayaw ID", 0);
    assert.equal(shift, 1);
    assert.deepEqual(
      api.resolveMappedField(
        { columnId: "due", field: "Due", fieldIndex: 4 },
        fields,
        {
          shift,
          taken: new Set(["Yayaw ID", "Name", "Due"]),
        }
      ),
      { status: "renamed", field: fields[2], from: "Due" }
    );
    // A position never resolves to a header another entry uses: ambiguous, never re-added.
    assert.equal(
      api.resolveMappedField(
        { columnId: "due", field: "Due", fieldIndex: 1 },
        fields,
        {
          shift,
          taken: new Set(["Name"]),
        }
      ).status,
      "ambiguous"
    );
    assert.deepEqual(
      api.upgradeMapping(
        [
          { columnId: "price", field: "Price", fieldId: "prc" },
          { columnId: "due", field: "Due" },
          { columnId: "skip", field: null },
        ],
        notion
      ),
      [
        { columnId: "price", field: "Cost", fieldId: "prc" },
        { columnId: "due", field: "Due", fieldId: "due" },
        { columnId: "skip", field: null },
      ]
    );
  });

  test("sheets: a header gone with an unusable saved position blocks (field_missing)", () => {
    const check = (fields: { name: string; index: number }[]) =>
      codes(
        api.checkTargetSchema({
          columns,
          mapping: [
            { columnId: "name", field: "Name", fieldIndex: 1 },
            { columnId: "due", field: "Due", fieldIndex: 2 },
          ],
          keyField: "Yayaw ID",
          keyFieldIndex: 0,
          targetSchema: { provider: "sheets", fields },
        })
      );
    // Nothing at the saved position.
    assert.deepEqual(
      check([
        { name: "Yayaw ID", index: 0 },
        { name: "Name", index: 1 },
      ]),
      ["blocking:field_missing:due"]
    );
    // The header there is mapped by another column.
    assert.deepEqual(
      check([
        { name: "Yayaw ID", index: 0 },
        { name: "Other", index: 1 },
        { name: "Name", index: 2 },
      ]),
      ["blocking:field_missing:due"]
    );
    assert.equal(
      api.schemaIssueMessage(
        {
          severity: "blocking",
          code: "field_missing",
          columnId: "due",
          field: "Due",
          detail: {},
        },
        { t: en, target: "the sheet", columns }
      ),
      "Due: “Due” is no longer in the sheet and its column can’t be found. Choose its field again."
    );
  });

  test("sheets: a renamed header is found through the key column's position", () => {
    const report = api.checkTargetSchema({
      columns,
      mapping: [
        { columnId: "name", field: "Name", fieldIndex: 1 },
        { columnId: "due", field: "Due", fieldIndex: 2 },
      ],
      keyField: "Yayaw ID",
      keyFieldIndex: 0,
      targetSchema: {
        provider: "sheets",
        fields: [
          { name: "Notes", index: 0 },
          { name: "Yayaw ID", index: 1 },
          { name: "Name", index: 2 },
          { name: "Due date", index: 3, type: "date" },
        ],
      },
    });
    assert.deepEqual(codes(report), ["warning:renamed_field:due"]);
    assert.deepEqual(report.issues[0]?.detail, { from: "Due", to: "Due date" });
  });

  test("Notion colors follow the table's option colors, else its tag hues", () => {
    assert.equal(api.notionColorFor({ value: "x", color: "red" }), "red");
    assert.equal(
      api.notionColorFor({
        value: "x",
        color: "bg-emerald-100 text-emerald-900",
      }),
      "green"
    );
    assert.equal(api.notionColorFor({ value: "x", color: "violet" }), "purple");
    const hue = api.notionColorFor({ value: "Service" });
    assert.equal(hue, api.notionColorFor({ value: " service " }));
    assert.notEqual(hue, "default");
    assert.equal(
      api.invalidSamples("number", ["1 200,50", "12%", "n/a", 4]),
      1
    );
  });

  const notionConnector = (
    overrides: Partial<Flow.DataDestinationConnector> = {}
  ) => {
    const calls = {
      describe: 0,
      pushed: [] as Flow.ConnectorSettings[],
      saved: [] as Flow.ConnectorSettings[],
      prepared: [] as Schema.SchemaFix[][],
    };
    let fields = notionFields.map((field) => ({ ...field }));
    const connector: Flow.DataDestinationConnector = {
      targets: () => [{ id: "live", label: "Live projects" }],
      describe: () => {
        calls.describe += 1;
        return { provider: "notion", fields, keyFields: ["Yayaw ID", "Name"] };
      },
      load: () => ({
        targetId: "live",
        mode: "upsert",
        keyField: "Yayaw ID",
        mapping: savedMapping,
        direction: "push",
      }),
      save: (settings) => {
        calls.saved.push(settings);
      },
      push: (settings) => {
        calls.pushed.push(settings);
        return pushResult();
      },
      prepareTarget: (fixes) => {
        calls.prepared.push(fixes);
        fields = [
          ...fields.map((field) =>
            field.name === "Category"
              ? { ...field, options: ["Software", "Hardware", "Service"] }
              : field
          ),
          { name: "Yayaw ID", id: "key", type: "rich_text" },
        ];
        return { applied: fixes };
      },
      ...overrides,
    };
    return { connector, calls };
  };

  const startFlow = async (connector: Flow.DataDestinationConnector) => {
    const flow = api.createConnectorFlow({
      connector,
      context: {},
      columns,
      selectedCount: 0,
      t: en,
      pushContext: () => ({}),
      onChange: () => undefined,
    });
    await flow.start();
    return flow;
  };

  const view = (
    flow: Flow.ConnectorFlow,
    connector: Flow.DataDestinationConnector
  ) =>
    api.describeSchemaReport(flow.state, {
      connector,
      name: "Notion",
      t: en,
      columns,
    });

  test("the screen checks a saved destination on open and follows a renamed field", async () => {
    const { connector, calls } = notionConnector();
    const flow = await startFlow(connector);
    const price = flow.state.settings?.mapping.find(
      (entry) => entry.columnId === "price"
    );
    assert.deepEqual(price, {
      columnId: "price",
      field: "Cost",
      fieldId: "prc",
    });
    assert.deepEqual(flow.state.renames, [
      { columnId: "price", from: "Price", to: "Cost" },
    ]);
    const report = view(flow, connector);
    assert.ok(report);
    assert.deepEqual(
      report.groups.map((group) => [
        group.severity,
        group.title,
        group.lines.map((line) => line.text),
      ]),
      [
        [
          "blocking",
          "To fix before sending",
          ["Progress: Notion property is Select, Number expected."],
        ],
        [
          "fixable",
          "Can be fixed for you",
          [
            "Category: 2 options missing in Notion: Hardware, Service",
            "“Yayaw ID” property missing: it holds each record’s id.",
          ],
        ],
        ["warning", "Good to know", ["Renamed in Notion: Price → Cost"]],
      ]
    );
    assert.equal(report.prepare, "Prepare Notion database");
    assert.equal(report.updateMapping, "Update mapping");
    assert.equal(
      report.blocked,
      "Fix this first: Progress: Notion property is Select, Number expected."
    );
    // The host runs the mapping by property id: its saved names follow on "Update mapping".
    assert.deepEqual(
      api.toConnectorMapping(flow.state.settings as Flow.ConnectorSettings)
        .propertyIds,
      {
        name: "title",
        category: "cat",
        status: "sts",
        price: "prc",
        progress: "prg",
        due: "due",
      }
    );
    await flow.updateMapping();
    assert.equal(
      calls.saved.at(-1)?.mapping.find((entry) => entry.columnId === "price")
        ?.field,
      "Cost"
    );
    assert.deepEqual(flow.state.renames, []);
    assert.equal(view(flow, connector)?.updateMapping, null);
  });

  test("a blocking issue stops Send with its reason until the mapping changes", async () => {
    const { connector, calls } = notionConnector();
    const flow = await startFlow(connector);
    await flow.send();
    assert.equal(calls.pushed.length, 0);
    assert.equal(
      flow.state.error,
      "Fix this first: Progress: Notion property is Select, Number expected."
    );
    await api.applyConnectorField(flow, "map:progress", api.CONNECTOR_SKIP);
    assert.equal(view(flow, connector)?.blocked, null);
    await flow.send();
    assert.equal(calls.pushed.length, 1);
    // A send saves the settings: the rename is now stored.
    assert.deepEqual(flow.state.renames, []);
  });

  test("Prepare applies the fixable issues, then reads the target again", async () => {
    const { connector, calls } = notionConnector();
    const flow = await startFlow(connector);
    const fixes = api.describeSchemaFixes(
      flow.state.schemaReport?.fixes ?? [],
      {
        connector,
        t: en,
        schema: flow.state.schema,
      }
    );
    assert.deepEqual(fixes, {
      intro:
        "These changes will be made in Notion. Nothing is deleted or renamed.",
      lines: [
        "Add 2 options to “Category”: Hardware, Service",
        "Create “Yayaw ID” (Text) for record ids",
      ],
      confirm: "Make these changes",
      cancel: "Cancel",
    });
    assert.deepEqual(
      api.describeSchemaFixes(flow.state.schemaReport?.fixes ?? [], {
        connector,
        t: fr,
        schema: flow.state.schema,
      }).lines,
      [
        "Ajouter 2 options à « Category » : Hardware, Service",
        "Créer « Yayaw ID » (Texte) pour les identifiants",
      ]
    );
    flow.showPrepare(true);
    assert.equal(flow.state.prepareOpen, true);
    await flow.prepare();
    assert.equal(calls.prepared.length, 1);
    assert.equal(calls.describe, 2);
    assert.equal(flow.state.prepareOpen, false);
    const report = view(flow, connector);
    assert.equal(report?.prepared, "2 changes made in Notion.");
    assert.equal(report?.prepare, null);
    assert.deepEqual(
      report?.groups.map((group) => group.severity),
      ["blocking", "warning"]
    );
    // The key now exists: it is saved with its id.
    assert.equal(flow.state.settings?.keyFieldId, "key");
  });

  test("mapping choices: the page title first, fields that don't fit disabled with the reason", async () => {
    const { connector } = notionConnector({ load: () => null });
    const flow = await startFlow(connector);
    await flow.selectTarget("live");
    const fields = api.connectorScreenFields(flow.state, {
      connector,
      columns,
      selectedCount: 0,
      t: en,
    });
    const rows = fields.filter(
      (field) => field.id.startsWith("map:") || field.id.startsWith("field:")
    );
    assert.deepEqual(
      rows
        .slice(0, 2)
        .map((row) => [row.id, row.label, row.heading, row.value]),
      [
        ["field:Name", "Name (page title)", "Page title", "name"],
        ["map:name", "Name", "Send each column to", "Name"],
      ]
    );
    // Defaults never pick a field the column cannot fill.
    const progress = rows.find((row) => row.id === "map:progress");
    assert.equal(progress?.value, api.CONNECTOR_SKIP);
    const disabled = progress?.options
      .filter((option) => option.disabled)
      .map((option) => option.label);
    assert.deepEqual(disabled, [
      "Name (used by Name)",
      "Category (Select, doesn’t fit)",
      "Status (Status, doesn’t fit)",
      "Progress (Select, doesn’t fit)",
      "Due (Date, doesn’t fit)",
      "Margin (Formula, read-only)",
      "Owner (Person, not supported yet)",
    ]);
    // The title row assigns the title to another column and frees the first one.
    await api.applyConnectorField(flow, "field:Name", "category");
    const mapping = flow.state.settings?.mapping ?? [];
    assert.deepEqual(
      mapping.filter((entry) => entry.field === "Name"),
      [{ columnId: "category", field: "Name", fieldId: "title" }]
    );
    assert.deepEqual(
      api
        .connectorFieldOptions(
          columns[3] as Flow.ConnectorColumn,
          { fields: notionFields },
          null,
          fr
        )
        .filter((option) => option.disabled)
        .map((option) => option.label),
      [
        "Category (Sélection, incompatible)",
        "Status (Statut, incompatible)",
        "Progress (Sélection, incompatible)",
        "Due (Date, incompatible)",
        "Margin (Formule, lecture seule)",
        "Owner (Personne, pas encore pris en charge)",
      ]
    );
  });

  test("a new target from the table's columns, with its parents and Notion colors", async () => {
    const created: unknown[] = [];
    const { connector } = notionConnector({
      load: () => null,
      createTarget: {
        parents: () => [{ id: "home", label: "Team home" }],
        create: (input) => {
          created.push(input);
          return { id: "new-db", label: input.title };
        },
      },
    });
    const flow = await startFlow(connector);
    const target = api
      .connectorScreenFields(flow.state, {
        connector,
        columns,
        selectedCount: 0,
        t: en,
      })
      .find((field) => field.id === "target");
    assert.deepEqual(target?.options.at(-1), {
      value: api.CONNECTOR_NEW_TARGET,
      label: "Create one from this table’s columns…",
    });
    await api.applyConnectorField(flow, "target", api.CONNECTOR_NEW_TARGET);
    assert.equal(flow.state.createOpen, true);
    assert.deepEqual(flow.state.createParents, [
      { id: "home", label: "Team home" },
    ]);
    await flow.createTarget({ title: " " });
    assert.equal(flow.state.error, "Enter a name.");
    await flow.createTarget({ title: "Roadmap", parentId: "home" });
    assert.equal(created.length, 1);
    const input = created[0] as {
      title: string;
      parentId: string;
      columns: Flow.ConnectorNewTargetColumn[];
    };
    assert.equal(input.title, "Roadmap");
    assert.equal(input.parentId, "home");
    assert.deepEqual(
      input.columns.find((column) => column.id === "category")?.options,
      [
        { name: "Software", color: api.notionColorFor({ value: "Software" }) },
        { name: "Hardware", color: "red" },
        { name: "Service", color: api.notionColorFor({ value: "Service" }) },
      ]
    );
    assert.equal(flow.state.createOpen, false);
    assert.equal(flow.state.targetId, "new-db");
    assert.deepEqual(
      flow.state.targets.map((item) => item.id),
      ["live", "new-db"]
    );
  });

  test("the host's checkSchema replaces the local check and gets the saved names", async () => {
    const checked: Flow.ConnectorSettings[] = [];
    const { connector } = notionConnector({
      checkSchema: (settings) => {
        checked.push(settings);
        return { issues: [], fixes: [] };
      },
    });
    const flow = await startFlow(connector);
    await flow.checkSchema();
    assert.deepEqual(flow.state.schemaReport, { issues: [], fixes: [] });
    assert.equal(
      checked.at(-1)?.mapping.find((entry) => entry.columnId === "price")
        ?.field,
      "Price"
    );
    assert.equal(view(flow, connector), null);
  });

  test("the target list can be read again; renames are measured against the stored settings", async () => {
    let lists = 0;
    const { connector } = notionConnector({
      targets: () => {
        lists += 1;
        return [
          {
            id: "live",
            label: lists > 1 ? "Live projects (2)" : "Live projects",
          },
        ];
      },
    });
    const flow = await startFlow(connector);
    await flow.refreshTargets();
    assert.equal(flow.state.targets[0]?.label, "Live projects (2)");
    assert.equal(flow.state.refreshing, false);
    assert.deepEqual(
      api.connectorRenames(
        { mapping: savedMapping },
        { provider: "notion", fields: notionFields }
      ),
      [{ columnId: "price", from: "Price", to: "Cost" }]
    );
    const settings = api.resolveConnectorSettings({
      columns,
      saved: { keyField: "Yayaw ID", mapping: savedMapping },
      schema: {
        provider: "notion",
        fields: notionFields,
        keyFields: ["Yayaw ID"],
      },
      target: { targetId: "live" },
    });
    assert.equal(
      settings.mapping.find((entry) => entry.columnId === "price")?.field,
      "Cost"
    );
  });
}
