import assert from "node:assert/strict";
import type * as Model from "../src/components/ui/yayaw-table/utils/connector-flow";

type ConnectorSyncModel = Pick<
  typeof Model,
  | "CONNECTOR_SKIP"
  | "applyConnectorField"
  | "connectorConflictRules"
  | "connectorDirections"
  | "connectorLabels"
  | "connectorMappingSections"
  | "connectorRuleHints"
  | "connectorScheduleSuffix"
  | "connectorScreenFields"
  | "connectorSettingsToSend"
  | "connectorSyncBlocker"
  | "connectorSyncFields"
  | "createConnectorFlow"
  | "describeSyncPreview"
  | "describeSyncResult"
  | "formatSyncValue"
  | "isConnectorImportSource"
  | "resolveConnectorSettings"
  | "resolveSyncSettings"
  | "toSyncPreview"
  | "toSyncRunResult"
  | "validateConnectorSettings"
>;

const columns = [
  { id: "name", header: "Name", type: "text", visible: true },
  { id: "price", header: "Price", type: "number", visible: true },
  { id: "status", header: "Status", type: "select", visible: true },
  { id: "notes", header: "Notes", type: "text", visible: false },
];

const schema = {
  fields: [
    { name: "Yayaw ID" },
    { name: "Name", sample: ["Alpha"] },
    { name: "Price", sample: [49, "n/a", "twelve"] },
    { name: "Status" },
  ],
  allowNewFields: true,
};

const emptyPreview = (patch: Partial<Model.SyncPreview> = {}) => ({
  createInTarget: 0,
  updateInTarget: 0,
  createInTable: 0,
  updateInTable: 0,
  deleteInTarget: 0,
  deleteInTable: 0,
  flagged: 0,
  conflicts: [],
  duplicates: 0,
  unchanged: 0,
  ...patch,
});

const pushResult = {
  created: 1,
  updated: 0,
  skipped: 0,
  failed: 0,
  failures: [],
  warnings: [],
  warningCount: 0,
  truncated: false,
};

const syncConnector = (calls: string[], preview = emptyPreview()) => ({
  directions: ["push", "pull", "two-way"] as Model.SyncDirection[],
  conflictRules: ["table-wins", "target-wins"] as Model.ConflictRule[],
  targets: () => [{ id: "sheet", label: "Sheet" }],
  describe: () => schema,
  push: () => {
    calls.push("push");
    return pushResult;
  },
  preview: (settings: Model.ConnectorSettings) => {
    calls.push(`preview:${settings.direction}`);
    return preview;
  },
  sync: (settings: Model.ConnectorSettings) => {
    calls.push(`sync:${settings.direction}:${settings.deletePolicy}`);
    return {
      applied: { createInTable: 2, updateInTarget: 1 },
      failed: 0,
      failures: [],
      flagged: 0,
      truncated: false,
    };
  },
});

/** The sync settings, preview and result helpers, run by the React and Vue test runners. */
export function connectorSyncSuite(
  test: (name: string, body: () => void | Promise<void>) => void,
  model: ConnectorSyncModel
) {
  const en = model.connectorLabels("en");
  const fr = model.connectorLabels("fr-FR");

  test("directions default to push; pull and two-way need sync and table.sync", () => {
    const sync = () => undefined;
    assert.deepEqual(model.connectorDirections({}), ["push"]);
    assert.deepEqual(
      model.connectorDirections({ directions: ["push", "pull", "pull"] }),
      ["push"]
    );
    assert.deepEqual(
      model.connectorDirections({ directions: ["two-way", "pull"], sync }),
      ["two-way", "pull"]
    );
    assert.deepEqual(
      model.connectorDirections(
        { directions: ["push", "two-way"], sync },
        false
      ),
      ["push"]
    );
    assert.deepEqual(model.connectorConflictRules(undefined), [
      "table-wins",
      "target-wins",
      "latest-wins",
    ]);
    assert.deepEqual(
      model.connectorConflictRules(["target-wins", "target-wins"]),
      ["target-wins"]
    );
    assert.equal(
      model.isConnectorImportSource({ directions: ["pull"] }),
      false
    );
    assert.equal(
      model.isConnectorImportSource({ directions: ["push", "pull"], sync }),
      true
    );
    assert.equal(
      model.isConnectorImportSource({ directions: ["pull"], sync }, false),
      false
    );
  });

  test("sync settings: preset, then remembered when offered, then defaults", () => {
    assert.deepEqual(model.resolveSyncSettings({}), {
      direction: "push",
      conflictRule: "table-wins",
      deletePolicy: "flag",
    });
    assert.deepEqual(
      model.resolveSyncSettings({
        directions: ["push", "two-way"],
        conflictRules: ["target-wins"],
        saved: {
          direction: "pull",
          conflictRule: "latest-wins",
          deletePolicy: "propagate",
        },
      }),
      {
        direction: "push",
        conflictRule: "target-wins",
        deletePolicy: "propagate",
      }
    );
    assert.equal(
      model.resolveSyncSettings({
        directions: ["push", "pull"],
        preset: "pull",
        saved: { direction: "push" },
      }).direction,
      "pull"
    );
    const settings = model.resolveConnectorSettings({
      columns,
      schema,
      target: { targetId: "sheet" },
      directions: ["push", "two-way"],
      saved: { direction: "two-way" },
    });
    assert.equal(settings.direction, "two-way");
    assert.equal(settings.deletePolicy, "flag");
  });

  test("which settings show for each direction", () => {
    assert.deepEqual(model.connectorSyncFields("push", { hasPreview: true }), {
      mode: true,
      scope: true,
      conflictRule: false,
      deletePolicy: false,
      preview: false,
    });
    assert.deepEqual(model.connectorSyncFields("pull", { hasPreview: true }), {
      mode: false,
      scope: false,
      conflictRule: false,
      deletePolicy: true,
      preview: true,
    });
    assert.deepEqual(model.connectorSyncFields("two-way"), {
      mode: false,
      scope: false,
      conflictRule: true,
      deletePolicy: true,
      preview: false,
    });
  });

  test("validation covers the direction and the conflict rule", () => {
    const base: Model.ConnectorSettings = {
      targetId: "sheet",
      mode: "upsert",
      keyField: "Yayaw ID",
      mapping: [{ columnId: "name", field: "Name" }],
      direction: "two-way",
      conflictRule: "latest-wins",
      deletePolicy: "flag",
    };
    const codes = (
      settings: Model.ConnectorSettings,
      options: Partial<Parameters<typeof model.validateConnectorSettings>[1]>
    ) =>
      model
        .validateConnectorSettings(settings, { schema, ...options })
        .map((issue) => issue.code);
    assert.deepEqual(codes(base, {}), ["invalid_direction"]);
    assert.deepEqual(
      codes(base, {
        directions: ["push", "two-way"],
        conflictRules: ["table-wins"],
      }),
      ["invalid_conflict_rule"]
    );
    assert.deepEqual(
      codes(
        { ...base, conflictRule: "table-wins" },
        {
          directions: ["push", "two-way"],
        }
      ),
      []
    );
    // A pull only reads fields the target has.
    const sent = model.connectorSettingsToSend(
      {
        ...base,
        direction: "pull",
        mapping: [
          { columnId: "name", field: "Name" },
          { columnId: "status", field: "Brand new" },
          { columnId: "notes", field: "Status" },
        ],
      },
      columns,
      schema
    );
    assert.deepEqual(
      sent.mapping.map((entry) => entry.field),
      ["Name", null, null]
    );
  });

  test("pull and two-way map each target field to a column", async () => {
    const calls: string[] = [];
    const connector = syncConnector(calls);
    const flow = model.createConnectorFlow({
      connector,
      context: {},
      columns,
      selectedCount: 2,
      t: en,
      direction: "pull",
      pushContext: (scope) => ({ scope }),
      onChange: () => undefined,
    });
    await flow.start();
    await model.applyConnectorField(flow, "target", "sheet");
    const options = {
      connector,
      columns,
      selectedCount: 2,
      t: en,
      name: "Spreadsheet",
    };
    const fields = () => model.connectorScreenFields(flow.state, options);
    assert.deepEqual(
      fields().map((field) => field.id),
      [
        "target",
        "direction",
        "columns",
        "field:Name",
        "field:Price",
        "field:Status",
        "keyField",
        "deletePolicy",
      ]
    );
    const direction = fields().find((field) => field.id === "direction");
    assert.deepEqual(
      direction?.options.map((option) => option.label),
      ["Send to Spreadsheet", "Import from Spreadsheet", "Keep both in sync"]
    );
    const sections = model.connectorMappingSections(fields());
    assert.deepEqual(
      sections.before.map((field) => field.id),
      ["target", "direction", "columns"]
    );
    const price = sections.rows.find((row) => row.id === "field:Price");
    assert.equal(sections.rows[0]?.heading, "Import each field into");
    assert.equal(price?.value, "price");
    assert.equal(price?.sample, "e.g. 49");
    assert.deepEqual(price?.badge, { label: "2 won’t convert", invalid: true });
    assert.equal(price?.options.at(-1)?.label, "Don’t import");

    // Moving a field to another column frees the column that had it.
    await model.applyConnectorField(flow, "field:Status", "name");
    assert.deepEqual(
      flow.state.settings?.mapping.map((entry) => [
        entry.columnId,
        entry.field,
      ]),
      [
        ["name", "Status"],
        ["price", "Price"],
        ["status", null],
        ["notes", "Notes"],
      ]
    );
    await model.applyConnectorField(flow, "field:Status", model.CONNECTOR_SKIP);
    assert.equal(flow.state.settings?.mapping[0]?.field, null);

    // Two-way adds the conflict rule and new fields the sync will create.
    await model.applyConnectorField(flow, "direction", "two-way");
    await model.applyConnectorField(flow, "columns", "all");
    const twoWay = fields().map((field) => field.id);
    assert.ok(twoWay.includes("field:Notes"));
    assert.deepEqual(twoWay.slice(-2), ["conflictRule", "deletePolicy"]);
    assert.deepEqual(
      fields()
        .find((field) => field.id === "conflictRule")
        ?.options.map((option) => option.label),
      ["This table wins", "Spreadsheet wins"]
    );
    assert.deepEqual(model.connectorRuleHints(flow.state.settings, options), {
      conflictRule: "Keeps the table’s value and writes it to Spreadsheet.",
      deletePolicy: "Lists records deleted on one side. Nothing is deleted.",
    });
    // Push keeps its mapping orientation, mode and records.
    await model.applyConnectorField(flow, "direction", "push");
    assert.deepEqual(
      fields()
        .map((field) => field.id)
        .slice(-2),
      ["keyField", "scope"]
    );
  });

  test("preview, confirmation and sync; push still calls push", async () => {
    const calls: string[] = [];
    const synced: Model.SyncRunResult[] = [];
    const contexts: string[] = [];
    const flow = model.createConnectorFlow({
      connector: syncConnector(calls, emptyPreview({ createInTable: 2 })),
      context: {},
      columns,
      selectedCount: 2,
      t: en,
      pushContext: (scope) => {
        contexts.push(scope);
        return { scope };
      },
      onChange: () => undefined,
      onSynced: (result) => synced.push(result),
    });
    await flow.start();
    await flow.selectTarget("sheet");
    assert.equal(flow.state.settings?.direction, "push");
    await flow.send();
    assert.deepEqual(calls, ["push"]);
    assert.equal(flow.state.result?.created, 1);
    flow.edit();

    flow.update({ direction: "two-way", deletePolicy: "propagate" });
    assert.equal(
      model.connectorSyncBlocker(flow.state, { preview: () => undefined }),
      "confirmDeletesFirst"
    );
    await flow.send();
    assert.equal(flow.state.error, "Confirm the deletions first.");
    flow.setConfirmDeletes(true);
    await flow.send();
    assert.equal(
      flow.state.error,
      "Preview the changes before deleting records."
    );
    await flow.preview();
    assert.equal(flow.state.preview?.createInTable, 2);
    // Any change makes the preview stale.
    flow.update({ conflictRule: "target-wins" });
    assert.equal(flow.state.preview, null);
    await flow.preview();
    await flow.send();
    assert.equal(flow.state.phase, "result");
    assert.deepEqual(calls.slice(1), [
      "preview:two-way",
      "preview:two-way",
      "sync:two-way:propagate",
    ]);
    // A sync always covers the view, whatever is selected.
    assert.equal(contexts.at(-1), "view");
    assert.equal(synced.length, 1);
    assert.equal(flow.state.syncResult?.applied.createInTable, 2);
    assert.equal(flow.state.confirmDeletes, false);
    // Changing the delete policy asks for the confirmation again.
    flow.edit();
    flow.setConfirmDeletes(true);
    flow.update({ deletePolicy: "flag" });
    assert.equal(flow.state.confirmDeletes, false);
    assert.equal(model.connectorSyncBlocker(flow.state, {}), null);
  });

  test("the preview grid, notes and conflicts in English and French", () => {
    const plan = {
      createInTarget: [1],
      updateInTarget: [1, 2],
      createInTable: [1, 2, 3],
      updateInTable: [],
      deleteInTarget: [],
      deleteInTable: [1],
      flagged: [1],
      duplicates: [1, 2],
      unchanged: 4,
      conflicts: [
        {
          rowId: "charlie",
          columnId: "price",
          tableValue: 399,
          targetValue: 420,
          winner: "table" as const,
        },
        {
          rowId: "delta",
          columnId: "status",
          tableValue: null,
          targetValue: ["A", "B"],
          winner: "target" as const,
        },
      ],
    };
    const preview = model.toSyncPreview(plan, {
      limit: 1,
      rowLabel: (id) => (id === "charlie" ? "Charlie display" : undefined),
    });
    assert.equal(preview.conflictCount, 2);
    assert.deepEqual(preview.conflicts, [
      {
        rowId: "charlie",
        rowLabel: "Charlie display",
        columnId: "price",
        tableValue: 399,
        targetValue: 420,
        resolution: "table",
      },
    ]);
    const view = model.describeSyncPreview(preview, {
      t: en,
      name: "Spreadsheet",
      columns,
    });
    assert.equal(view.empty, false);
    assert.deepEqual(
      view.sides.map((side) => [
        side.title,
        side.counts.map((count) => count.count),
      ]),
      [
        ["In Spreadsheet", [1, 2, 0]],
        ["In this table", [3, 0, 1]],
      ]
    );
    assert.deepEqual(view.notes, [
      "1 record deleted on one side is flagged.",
      "4 unchanged",
    ]);
    assert.equal(
      view.duplicates,
      "2 keys are shared by several records; they are left alone."
    );
    assert.equal(view.conflictsTitle, "Changed on both sides (2)");
    assert.deepEqual(view.conflicts[0], {
      id: "charlie:price",
      title: "Charlie display · Price",
      table: { label: "This table", value: "399" },
      target: { label: "Spreadsheet", value: "420" },
      resolution: "table",
      wins: "This table wins",
    });
    assert.equal(view.moreConflicts, "And 1 more");
    const french = model.describeSyncPreview(emptyPreview({ unchanged: 1 }), {
      t: fr,
      name: "Notion",
    });
    assert.equal(french.empty, true);
    assert.deepEqual(french.notes, [
      "Rien à changer : les deux côtés correspondent.",
      "1 inchangés",
    ]);
    assert.equal(french.sides[0]?.title, "Dans Notion");
    assert.equal(model.formatSyncValue(["A", "B"], en), "A, B");
    assert.equal(model.formatSyncValue("", fr), "(vide)");
  });

  test("sync results: applied counts by side, failures, flagged and stop reason", () => {
    const result = model.toSyncRunResult(
      {
        applied: {
          createInTarget: 0,
          updateInTarget: 1,
          setKeyInTarget: 2,
          createInTable: 2,
          deleteInTable: 1,
        },
        failed: 1,
        failures: [{ code: "rate_limited", rowId: "echo" }],
        stopped: "unauthorized",
      },
      { flagged: [1] }
    );
    assert.deepEqual(result.applied, {
      updateInTarget: 1,
      createInTable: 2,
      deleteInTable: 1,
    });
    const described = model.describeSyncResult(result, {
      t: en,
      name: "Spreadsheet",
    });
    assert.equal(
      described.summary,
      "In Spreadsheet: 1 updated · In this table: 2 created, 1 deleted · 1 failed"
    );
    assert.deepEqual(described.lines, [
      "Record echo: Too many requests. Wait a moment, then try again.",
      "1 record deleted on one side is flagged.",
      "The sync stopped: The connection has expired. Reconnect it, then try again.",
    ]);
    assert.equal(
      model.describeSyncResult(
        { applied: {}, failed: 0, failures: [], flagged: 0, truncated: false },
        { t: fr, name: "Notion" }
      ).summary,
      "Rien n’a changé"
    );
  });

  test("the schedule summary names the direction when there is a choice", () => {
    const connector = {
      directions: ["push", "two-way"] as Model.SyncDirection[],
      sync: () => undefined,
    };
    assert.equal(
      model.connectorScheduleSuffix(
        { direction: "two-way" },
        {
          connector,
          t: en,
        }
      ),
      "Keep in sync"
    );
    assert.equal(
      model.connectorScheduleSuffix(null, { connector, t: fr }),
      "Envoi"
    );
    assert.equal(
      model.connectorScheduleSuffix(
        { direction: "two-way" },
        {
          connector,
          t: en,
          syncEnabled: false,
        }
      ),
      null
    );
  });
}
