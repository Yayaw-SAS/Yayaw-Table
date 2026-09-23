import assert from "node:assert/strict";
import type * as Model from "../src/components/ui/yayaw-table/utils/connector-flow";

type ConnectorFlowModel = Pick<
  typeof Model,
  | "CONNECTOR_NO_TARGET"
  | "CONNECTOR_SKIP"
  | "applyConnectorField"
  | "connectorScreenFields"
  | "connectorErrorMessage"
  | "connectorFieldOptions"
  | "connectorKeyFields"
  | "connectorLabels"
  | "connectorModes"
  | "connectorSettingsToSend"
  | "createConnectorFlow"
  | "defaultConnectorMapping"
  | "describePushDetails"
  | "describePushResult"
  | "hasConnector"
  | "isConnectorTypeCompatible"
  | "resolveConnectorSettings"
  | "toConnectorFailure"
  | "toConnectorMapping"
  | "validateConnectorSettings"
>;

const columns = [
  { id: "name", header: "Name", type: "text", visible: true },
  { id: "due", header: "Échéance", type: "date", visible: true },
  { id: "status", header: "Status", type: "select", visible: true },
  { id: "price", header: "Price", type: "number", visible: false },
];

const result = (patch: Partial<Model.ConnectorPushResult> = {}) => ({
  created: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  failures: [],
  warnings: [],
  warningCount: 0,
  truncated: false,
  ...patch,
});

const LEFT_OUT = /left out/;

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The connector helpers and screen flow, run by the React and Vue test runners. */
export function connectorFlowSuite(
  test: (name: string, body: () => void | Promise<void>) => void,
  model: ConnectorFlowModel
) {
  const en = model.connectorLabels("en");
  const fr = model.connectorLabels("fr-FR");

  test("maps columns by normalized header, compatible types first", () => {
    const mapping = model.defaultConnectorMapping(
      columns,
      [
        { name: "name", type: "title" },
        { name: "ECHEANCE", type: "number" },
        { name: "echeance", type: "date" },
        { name: "Yayaw ID" },
      ],
      { keyField: "Yayaw ID" }
    );
    assert.deepEqual(mapping, [
      { columnId: "name", field: "name" },
      { columnId: "due", field: "echeance" },
      { columnId: "status", field: null },
      { columnId: "price", field: null },
    ]);
  });

  test("unmatched columns become new fields only when the target allows it", () => {
    const mapping = model.defaultConnectorMapping(columns, [{ name: "Name" }], {
      allowNewFields: true,
    });
    assert.deepEqual(
      mapping.map((entry) => entry.field),
      ["Name", "Échéance", "Status", "Price"]
    );
    // A field is used once; the key field is never a column's target.
    const once = model.defaultConnectorMapping(
      [
        { id: "a", header: "Name" },
        { id: "b", header: "name" },
        { id: "c", header: "Yayaw ID" },
      ],
      [{ name: "Name" }, { name: "Yayaw ID" }],
      { keyField: "Yayaw ID" }
    );
    assert.deepEqual(
      once.map((entry) => entry.field),
      ["Name", null, null]
    );
  });

  test("type families: text takes anything, a select fits a multi-select", () => {
    assert.equal(model.isConnectorTypeCompatible("number", "rich_text"), true);
    assert.equal(
      model.isConnectorTypeCompatible("select", "multi_select"),
      true
    );
    assert.equal(model.isConnectorTypeCompatible("date", "number"), false);
    assert.equal(model.isConnectorTypeCompatible(undefined, "number"), true);
  });

  test("key fields default to Yayaw ID and modes to upsert", () => {
    assert.deepEqual(
      model.connectorKeyFields({ fields: [], allowNewFields: true }),
      ["Yayaw ID"]
    );
    assert.deepEqual(
      model.connectorKeyFields({ fields: [{ name: "Id" }], keyFields: ["Id"] }),
      ["Id"]
    );
    assert.deepEqual(model.connectorModes(undefined), ["upsert"]);
    assert.deepEqual(model.connectorModes(["replace", "replace", "upsert"]), [
      "replace",
      "upsert",
    ]);
  });

  test("remembered settings apply where they still fit the target", () => {
    const schema = {
      fields: [{ name: "Name" }, { name: "Status" }, { name: "Yayaw ID" }],
    };
    const settings = model.resolveConnectorSettings({
      columns,
      modes: ["upsert", "replace"],
      saved: {
        targetId: "old",
        mode: "replace",
        keyField: "Gone",
        mapping: [
          { columnId: "name", field: null },
          { columnId: "status", field: "Removed" },
        ],
      },
      schema,
      target: { targetId: "sheet", childId: "tab" },
    });
    assert.equal(settings.targetId, "sheet");
    assert.equal(settings.childId, "tab");
    assert.equal(settings.mode, "replace");
    assert.equal(settings.keyField, "Yayaw ID");
    assert.equal(settings.columns, "visible");
    assert.deepEqual(settings.mapping, [
      { columnId: "name", field: null },
      { columnId: "due", field: null },
      { columnId: "status", field: "Status" },
      { columnId: "price", field: null },
    ]);
    // Hidden columns are sent only with "all columns".
    const all = model.connectorSettingsToSend(
      {
        ...settings,
        columns: "all",
        mapping: [{ columnId: "price", field: "Price" }],
      },
      columns
    );
    assert.deepEqual(all.mapping, [{ columnId: "price", field: "Price" }]);
    const visible = model.connectorSettingsToSend(
      { ...all, columns: "visible" },
      columns
    );
    assert.deepEqual(visible.mapping, [{ columnId: "price", field: null }]);
  });

  test("validation reports duplicates, unknown fields, key and mode", () => {
    const schema = { fields: [{ name: "Name" }, { name: "Yayaw ID" }] };
    const base = {
      targetId: "sheet",
      mode: "upsert" as const,
      keyField: "Yayaw ID",
      mapping: [{ columnId: "name", field: "Name" }],
    };
    assert.deepEqual(model.validateConnectorSettings(base, { schema }), []);
    const codes = (
      settings: Model.ConnectorSettings,
      target?: Model.ConnectorTarget
    ) =>
      model
        .validateConnectorSettings(settings, { schema, target })
        .map((issue) => issue.code);
    assert.deepEqual(
      codes({
        ...base,
        mapping: [
          { columnId: "name", field: "Name" },
          { columnId: "status", field: "name" },
          { columnId: "due", field: "Missing" },
        ],
      }),
      ["duplicate_field", "unknown_field"]
    );
    assert.deepEqual(
      codes({ ...base, mapping: [{ columnId: "name", field: null }] }),
      ["no_columns"]
    );
    assert.deepEqual(codes({ ...base, keyField: "" }), ["missing_key"]);
    assert.deepEqual(codes({ ...base, keyField: "Other" }), ["unknown_key"]);
    assert.deepEqual(codes({ ...base, mode: "replace" }), ["invalid_mode"]);
    assert.deepEqual(
      codes(
        { ...base, targetId: "" },
        { id: "x", label: "X", children: [{ id: "a", label: "A" }] }
      ),
      ["missing_target", "missing_child"]
    );
  });

  test("results read as counts in English and French", () => {
    assert.equal(
      model.describePushResult(
        result({ created: 3, updated: 5, failed: 1 }),
        en
      ),
      "3 created, 5 updated, 1 failed"
    );
    assert.equal(model.describePushResult(result(), en), "Nothing to send");
    assert.equal(
      model.describePushResult(result({ created: 1, skipped: 2 }), fr),
      "1 créé, 2 ignorés"
    );
    const details = model.describePushDetails(
      result({
        failed: 3,
        failures: [
          { code: "rate_limited", rowId: "alpha", rows: 1 },
          { code: "provider_unavailable", rows: 2 },
        ],
        warningCount: 1,
        truncated: true,
      }),
      en
    );
    assert.deepEqual(details.failures, [
      "Record alpha: Too many requests. Wait a moment, then try again.",
      "2 records: The service is unavailable right now. Try again later.",
    ]);
    assert.equal(details.warnings, "1 warning");
    assert.match(details.truncated ?? "", LEFT_OUT);
  });

  test("errors become messages; not_shared names the account", () => {
    assert.equal(
      model.connectorErrorMessage(
        "not_shared",
        { serviceAccountEmail: "robot@example.com" },
        en
      ),
      "Share this destination with robot@example.com, then send again."
    );
    assert.equal(
      model.connectorErrorMessage(
        "not_shared",
        { serviceAccountEmail: "robot@example.com" },
        en,
        {
          notShared: (details) =>
            `Share the spreadsheet with ${details.serviceAccountEmail}`,
        }
      ),
      "Share the spreadsheet with robot@example.com"
    );
    assert.equal(
      model.connectorErrorMessage("unauthorized", undefined, fr),
      "La connexion a expiré. Reconnectez-la, puis réessayez."
    );
    assert.equal(
      model.connectorErrorMessage("teapot", undefined, en),
      "Sending failed."
    );
    const overridden = model.connectorLabels("en", (key, fallback) =>
      key === "send" ? "Push" : fallback
    );
    assert.equal(overridden("send"), "Push");
  });

  test("thrown and returned errors are typed failures", () => {
    const thrown = Object.assign(new Error("nope"), {
      code: "not_shared",
      details: { serviceAccountEmail: "a@b.c" },
    });
    assert.deepEqual(model.toConnectorFailure(thrown), {
      code: "not_shared",
      details: { serviceAccountEmail: "a@b.c" },
      message: "nope",
    });
    assert.equal(
      model.toConnectorFailure({ error: { code: "rate_limited" } }).code,
      "rate_limited"
    );
    assert.deepEqual(model.toConnectorFailure(new Error("Boom")), {
      code: "unknown",
      message: "Boom",
    });
  });

  test("field options add a new field and Don't send; the server mapping skips nulls", () => {
    const options = model.connectorFieldOptions(
      { id: "due", header: "Due" },
      { fields: [{ name: "Name" }], allowNewFields: true },
      "Due",
      en
    );
    assert.deepEqual(options, [
      { value: "Name", label: "Name" },
      { value: "Due", label: "New field “Due”" },
      { value: model.CONNECTOR_SKIP, label: "Don’t send" },
    ]);
    assert.deepEqual(
      model.toConnectorMapping({
        keyField: "Yayaw ID",
        mapping: [
          { columnId: "name", field: "Name" },
          { columnId: "due", field: null },
        ],
      }),
      { keyProperty: "Yayaw ID", properties: { name: "Name" } }
    );
  });

  test("only Connect destinations with targets, describe and push get the screen", () => {
    const connector = {
      targets: () => [],
      describe: () => ({ fields: [] }),
      push: () => result(),
    };
    assert.equal(
      model.hasConnector({ kind: "connect", connector }, true),
      true
    );
    assert.equal(
      model.hasConnector({ kind: "connect", connector }, false),
      false
    );
    assert.equal(
      model.hasConnector({ kind: "share", connector }, undefined),
      false
    );
    assert.equal(model.hasConnector({ kind: "connect" }, undefined), false);
  });

  test("the flow loads, maps, validates, saves, pushes and reports", async () => {
    const saved: Model.ConnectorSettings[] = [];
    const pushed: {
      settings: Model.ConnectorSettings;
      scope: string;
      columns: string[];
    }[] = [];
    const states: Model.ConnectorFlowState[] = [];
    const flow = model.createConnectorFlow({
      connector: {
        targets: () => [
          {
            id: "tracker",
            label: "Tracker",
            children: [{ id: "projects", label: "Projects" }],
          },
          { id: "private", label: "Private" },
        ],
        describe: (target) => {
          if (target.targetId === "private") {
            throw Object.assign(new Error("denied"), {
              code: "not_shared",
              details: { serviceAccountEmail: "robot@example.com" },
            });
          }
          return {
            fields: [{ name: "Name" }, { name: "Status" }],
            allowNewFields: true,
          };
        },
        load: () => null,
        save: (settings) => {
          saved.push(settings);
        },
        push: (
          settings,
          context: { scope: string; columns: { id: string }[] }
        ) => {
          pushed.push({
            settings,
            scope: context.scope,
            columns: context.columns.map((column) => column.id),
          });
          return result({ created: 3 });
        },
      },
      context: {},
      columns,
      selectedCount: 0,
      t: en,
      pushContext: (scope, sent) => ({ scope, columns: sent }),
      onChange: (state) => states.push(state),
    });
    await flow.start();
    assert.equal(flow.state.phase, "form");
    assert.equal(flow.state.scope, "view");
    await flow.selectTarget("tracker");
    assert.equal(flow.state.childId, "projects");
    assert.deepEqual(
      flow.state.settings?.mapping.map((entry) => entry.field),
      ["Name", "Échéance", "Status", "Price"]
    );
    flow.setField("status", model.CONNECTOR_SKIP);
    await flow.send();
    assert.equal(flow.state.phase, "result");
    assert.equal(flow.state.result?.created, 3);
    assert.equal(saved.length, 1);
    assert.deepEqual(pushed[0]?.columns, ["name", "due"]);
    assert.equal(pushed[0]?.settings.keyField, "Yayaw ID");
    assert.ok(states.some((state) => state.phase === "sending"));

    flow.edit();
    flow.setField("name", model.CONNECTOR_SKIP);
    flow.setField("due", model.CONNECTOR_SKIP);
    await flow.send();
    assert.equal(flow.state.error, "Choose at least one column to send.");
    assert.equal(pushed.length, 1);

    await flow.selectTarget("private");
    await tick();
    assert.equal(flow.state.settings, null);
    assert.equal(
      flow.state.error,
      "Share this destination with robot@example.com, then send again."
    );
  });

  test("the flow reopens the remembered target and returned push errors show inline", async () => {
    const flow = model.createConnectorFlow({
      connector: {
        targets: () => [],
        allowTargetInput: {
          label: "Link",
          resolve: (input) => ({ id: input, label: `Sheet ${input}` }),
        },
        describe: () => ({ fields: [{ name: "Name" }, { name: "Yayaw ID" }] }),
        load: () => ({
          targetId: "remembered",
          mode: "upsert",
          keyField: "Yayaw ID",
          mapping: [{ columnId: "name", field: "Name" }],
        }),
        push: () => ({ error: { code: "rate_limited" } }),
      },
      context: {},
      columns,
      selectedCount: 2,
      t: en,
      pushContext: (scope) => ({ scope }),
      onChange: () => undefined,
    });
    await flow.start();
    assert.equal(flow.state.targetId, "remembered");
    assert.equal(flow.state.targets.at(-1)?.label, "remembered");
    assert.equal(flow.state.scope, "selection");
    await flow.send();
    assert.equal(flow.state.phase, "form");
    assert.equal(
      flow.state.error,
      "Too many requests. Wait a moment, then try again."
    );
    await flow.resolveInput("  abc ");
    assert.equal(flow.state.targetId, "abc");
    assert.equal(flow.state.targets.at(-1)?.label, "Sheet abc");
  });

  test("both editions render the same screen fields and apply choices the same way", async () => {
    const connector = {
      labels: { target: "Spreadsheet", child: "Tab" },
      modes: ["upsert", "replace"] as Model.ConnectorMode[],
      targets: () => [
        {
          id: "tracker",
          label: "Tracker",
          children: [{ id: "projects", label: "Projects" }],
        },
      ],
      describe: () => ({ fields: [{ name: "Name" }], allowNewFields: true }),
      push: () => result(),
    };
    const flow = model.createConnectorFlow({
      connector,
      context: {},
      columns,
      selectedCount: 2,
      t: en,
      pushContext: (scope) => ({ scope }),
      onChange: () => undefined,
    });
    await flow.start();
    const options = { connector, columns, selectedCount: 2, t: en };
    const [target] = model.connectorScreenFields(flow.state, options);
    assert.equal(target?.label, "Spreadsheet");
    assert.equal(target?.value, model.CONNECTOR_NO_TARGET);
    await model.applyConnectorField(flow, "target", "tracker");
    const ids = () =>
      model.connectorScreenFields(flow.state, options).map((field) => field.id);
    assert.deepEqual(ids(), [
      "target",
      "child",
      "columns",
      "map:name",
      "map:due",
      "map:status",
      "keyField",
      "mode",
      "scope",
    ]);
    await model.applyConnectorField(flow, "columns", "all");
    assert.ok(ids().includes("map:price"));
    await model.applyConnectorField(flow, "map:due", model.CONNECTOR_SKIP);
    await model.applyConnectorField(flow, "mode", "replace");
    await model.applyConnectorField(flow, "scope", "view");
    const fields = model.connectorScreenFields(flow.state, options);
    assert.equal(
      fields.find((field) => field.id === "map:due")?.value,
      model.CONNECTOR_SKIP
    );
    assert.equal(
      fields.find((field) => field.id === "map:name")?.heading,
      "Send each column to"
    );
    assert.equal(fields.find((field) => field.id === "mode")?.value, "replace");
    assert.equal(
      fields.find((field) => field.id === "scope")?.options.at(-1)?.label,
      "Selected (2)"
    );
    assert.equal(flow.state.scope, "view");
  });
}
