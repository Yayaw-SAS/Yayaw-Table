import assert from "node:assert/strict";
import type * as Model from "../src/components/ui/yayaw-table/utils/connector-flow";

type ConnectorSyncModel = Pick<
  typeof Model,
  | "CONNECTOR_SKIP"
  | "applyConnectorField"
  | "canResolveConflicts"
  | "connectorConflictRules"
  | "connectorConflictRulesView"
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
  | "describeConflictRules"
  | "describePendingConflicts"
  | "describeSyncPreview"
  | "describeSyncResult"
  | "formatSyncValue"
  | "isConnectorImportSource"
  | "resolveConnectorSettings"
  | "resolveSyncSettings"
  | "toPendingConflicts"
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
      winner: "table",
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

  // Conflict rules in code ---------------------------------------------------

  const emptyPlan = {
    createInTarget: [],
    updateInTarget: [],
    createInTable: [],
    updateInTable: [],
    deleteInTarget: [],
    deleteInTable: [],
    flagged: [],
    duplicates: [],
    unchanged: 0,
    conflicts: [],
  };

  const appRules: Model.ConnectorConflictRules = {
    ownership: { price: "target", name: "table" },
    columnRules: {
      notes: "merge",
      status: "manual",
      price: "table-wins",
      unknown: "sometimes" as Model.ColumnConflictRule,
    },
    lock: true,
  };

  test("declared conflict rules read as sentences, owned columns first", () => {
    const options = { t: en, name: "Spreadsheet", columns };
    assert.deepEqual(
      model
        .describeConflictRules(appRules, options)
        .map((rule) => [rule.columnId, rule.kind, rule.text]),
      [
        ["name", "owned", "Name: this table is the source of truth"],
        ["price", "owned", "Price: Spreadsheet is the source of truth"],
        ["status", "manual", "Status: decided by you"],
        ["notes", "merge", "Notes: merged"],
      ]
    );
    // Outside two-way only ownership applies.
    assert.deepEqual(
      model
        .describeConflictRules(appRules, { ...options, direction: "pull" })
        .map((rule) => rule.columnId),
      ["name", "price"]
    );
    assert.deepEqual(
      model
        .describeConflictRules(
          { columnRules: { price: "target-wins", name: "latest-wins" } },
          { t: fr, name: "Notion", columns }
        )
        .map((rule) => rule.text),
      ["Name : la dernière modification l’emporte", "Price : Notion l’emporte"]
    );
    assert.deepEqual(model.describeConflictRules(undefined, options), []);
  });

  test("locked rules: a read-only conflict rule and the app's rules shown", async () => {
    const connector = { ...syncConnector([]), conflicts: appRules };
    const flow = model.createConnectorFlow({
      connector,
      context: {},
      columns,
      selectedCount: 0,
      t: en,
      pushContext: (scope) => ({ scope }),
      onChange: () => undefined,
    });
    await flow.start();
    await flow.selectTarget("sheet");
    flow.update({ direction: "two-way" });
    const screen = {
      connector,
      columns,
      selectedCount: 0,
      t: en,
      name: "Spreadsheet",
    };
    const rule = model
      .connectorScreenFields(flow.state, screen)
      .find((field) => field.id === "conflictRule");
    assert.equal(rule?.disabled, true);
    // The app's rule cannot be changed from the screen.
    flow.update({ conflictRule: "target-wins", deletePolicy: "ignore" });
    assert.equal(flow.state.settings?.conflictRule, "table-wins");
    assert.equal(flow.state.settings?.deletePolicy, "ignore");
    const view = model.connectorConflictRulesView(flow.state.settings, screen);
    assert.equal(view?.title, "Rules set by your app");
    assert.equal(view?.locked, true);
    assert.equal(
      view?.hint,
      "Your app decides conflicts; these rules can’t be changed here."
    );
    assert.equal(view?.rules.length, 4);
    // A push has no rules to show; an unlocked connector keeps its select.
    assert.equal(
      model.connectorConflictRulesView({ direction: "push" }, screen),
      null
    );
    const open = { ...screen, connector: syncConnector([]) };
    assert.equal(
      model
        .connectorScreenFields(flow.state, open)
        .find((field) => field.id === "conflictRule")?.disabled,
      undefined
    );
    assert.equal(
      model.connectorConflictRulesView({ direction: "two-way" }, open),
      null
    );
  });

  test("preview lines say how each conflict is settled", () => {
    const plan = {
      ...emptyPlan,
      updateInTable: [1],
      conflicts: [
        {
          rowId: "alpha",
          columnId: "status",
          tableValue: "Active",
          targetValue: "Archived",
          winner: "table" as const,
          resolution: "manual" as const,
          source: "column" as const,
        },
        {
          rowId: "bravo",
          columnId: "notes",
          tableValue: ["a"],
          targetValue: ["b"],
          winner: "table" as const,
          resolution: "merged" as const,
          source: "column" as const,
          value: ["a", "b"],
        },
      ],
      overridden: [
        {
          rowId: "charlie",
          columnId: "price",
          tableValue: 399,
          targetValue: 1420,
          owner: "target" as const,
        },
      ],
      pendingConflicts: [{}, {}],
    };
    const preview = model.toSyncPreview(plan, {
      rowLabel: (id) => id.toUpperCase(),
    });
    assert.equal(preview.pendingConflicts, 2);
    assert.equal(preview.overriddenCount, 1);
    assert.deepEqual(preview.overridden?.[0], {
      rowId: "charlie",
      rowLabel: "CHARLIE",
      columnId: "price",
      tableValue: 399,
      targetValue: 1420,
      resolution: "target",
      source: "ownership",
    });
    assert.deepEqual(preview.conflicts[1]?.value, ["a", "b"]);
    const view = model.describeSyncPreview(preview, {
      t: en,
      name: "Spreadsheet",
      columns,
      locale: "en-US",
    });
    assert.deepEqual(
      view.conflicts.map((line) => [line.id, line.wins, line.winner]),
      [
        ["alpha:status", "Needs your decision", undefined],
        ["bravo:notes", "Merged", undefined],
      ]
    );
    assert.deepEqual(view.conflicts[1]?.result, {
      label: "Result",
      value: "a, b",
    });
    assert.equal(view.overriddenTitle, "Kept from the side that owns them (1)");
    assert.deepEqual(view.overridden[0], {
      id: "charlie:price",
      title: "CHARLIE · Price",
      table: { label: "This table", value: "399" },
      target: { label: "Spreadsheet", value: "1,420" },
      resolution: "target",
      winner: "target",
      wins: "Owned by Spreadsheet",
    });
    assert.ok(view.notes.includes("2 conflicts will wait for your decision."));
    const french = model.describeSyncPreview(preview, {
      t: fr,
      name: "Notion",
      columns,
    });
    assert.deepEqual(
      [...french.conflicts, ...french.overridden].map((line) => line.wins),
      ["À décider par vous", "Fusionné", "Appartient à Notion"]
    );
    assert.equal(model.formatSyncValue(true, en), "Yes");
    assert.equal(model.formatSyncValue(false, fr), "Non");
    assert.equal(
      model.formatSyncValue(1200.5, en, { type: "number", locale: "de-DE" }),
      "1.200,5"
    );
    assert.equal(
      model.formatSyncValue("n/a", en, { type: "number", locale: "en-US" }),
      "n/a"
    );
  });

  test("conflicts to resolve: listed, resolved one by one or all at once", async () => {
    const calls: string[] = [];
    let pending: Model.PendingConflict[] = [
      {
        rowId: "alpha",
        rowLabel: "Alpha launch",
        columnId: "status",
        tableValue: "Active",
        targetValue: "Archived",
      },
      {
        rowId: "bravo",
        columnId: "price",
        tableValue: 120,
        targetValue: 1300,
      },
    ];
    const synced: Model.SyncRunResult[] = [];
    const connector = {
      ...syncConnector(calls),
      conflicts: { columnRules: { status: "manual" as const } },
      listConflicts: () => {
        calls.push("list");
        return pending;
      },
      resolveConflicts: (resolutions: Model.PendingConflictResolution[]) => {
        calls.push(
          `resolve:${resolutions.map((item) => `${item.rowId}=${JSON.stringify(item.choice)}`).join(",")}`
        );
        pending = pending.filter(
          (item) => !resolutions.some((done) => done.rowId === item.rowId)
        );
        return {
          applied: { updateInTable: 1 },
          failed: 0,
          failures: [],
          flagged: 0,
          truncated: false,
        };
      },
    };
    assert.equal(model.canResolveConflicts(connector), true);
    assert.equal(
      model.canResolveConflicts({
        ...connector,
        conflicts: { allowManual: false },
      }),
      false
    );
    const flow = model.createConnectorFlow({
      connector,
      context: {},
      columns,
      selectedCount: 0,
      t: en,
      pushContext: (scope) => ({ scope }),
      onChange: () => undefined,
      onSynced: (result) => synced.push(result),
    });
    await flow.start();
    await flow.selectTarget("sheet");
    assert.equal(flow.state.conflicts?.length, 2);
    const view = model.describePendingConflicts(flow.state.conflicts, {
      t: en,
      name: "Spreadsheet",
      columns,
      locale: "en-US",
    });
    assert.equal(view.entry, "Conflicts to resolve (2)");
    assert.deepEqual(view.lines[1], {
      id: "bravo:price",
      rowId: "bravo",
      columnId: "price",
      title: "bravo · Price",
      table: { label: "This table", value: "120" },
      target: { label: "Spreadsheet", value: "1,300" },
      keepTable: "Keep table value",
      keepTarget: "Keep Spreadsheet value",
    });
    assert.deepEqual(
      [view.keepAllTable, view.keepAllTarget, view.back],
      ["Keep all table values", "Keep all Spreadsheet values", "Back"]
    );
    flow.showConflicts(true);
    assert.equal(flow.state.conflictsOpen, true);
    await flow.resolveConflicts([
      { rowId: "alpha", columnId: "status", choice: "target" },
    ]);
    assert.equal(synced.length, 1);
    assert.deepEqual(
      flow.state.conflicts?.map((item) => item.rowId),
      ["bravo"]
    );
    await flow.resolveConflicts([
      { rowId: "bravo", columnId: "price", choice: "table" },
    ]);
    assert.deepEqual(flow.state.conflicts, []);
    assert.equal(
      model.describePendingConflicts(flow.state.conflicts, {
        t: fr,
        name: "Notion",
      }).entry,
      null
    );
    assert.deepEqual(calls, [
      "list",
      'resolve:alpha="target"',
      "list",
      'resolve:bravo="table"',
      "list",
    ]);
    // A sync lists them again.
    flow.update({ direction: "two-way" });
    await flow.send();
    assert.equal(calls.at(-1), "list");
    assert.deepEqual(
      model.toPendingConflicts(
        [{ rowId: "r1", columnId: "status", tableValue: 1, targetValue: 2 }],
        { rowLabel: () => "Row one" }
      ),
      [
        {
          rowId: "r1",
          rowLabel: "Row one",
          columnId: "status",
          tableValue: 1,
          targetValue: 2,
        },
      ]
    );
  });
}
