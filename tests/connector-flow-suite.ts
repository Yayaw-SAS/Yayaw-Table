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
  | "connectorMappingSections"
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
        { name: "ID" },
      ],
      { keyField: "ID" }
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
        { id: "c", header: "ID" },
      ],
      [{ name: "Name" }, { name: "ID" }],
      { keyField: "ID" }
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

  test("key fields default to ID and modes to upsert", () => {
    assert.deepEqual(
      model.connectorKeyFields({ fields: [], allowNewFields: true }),
      ["ID"]
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

  test("a saved legacy key field keeps matching the same existing records", () => {
    const settings = model.resolveConnectorSettings({
      columns,
      modes: ["upsert"],
      saved: {
        targetId: "sheet",
        mode: "upsert",
        keyField: "Yayaw ID",
        mapping: [{ columnId: "name", field: "Name" }],
      },
      schema: {
        fields: [{ name: "Name" }, { name: "Yayaw ID" }],
        allowNewFields: true,
      },
      target: { targetId: "sheet" },
    });
    assert.equal(settings.keyField, "Yayaw ID");
  });

  test("remembered settings apply where they still fit the target", () => {
    const schema = {
      fields: [{ name: "Name" }, { name: "Status" }, { name: "ID" }],
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
    assert.equal(settings.keyField, "ID");
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
    const schema = { fields: [{ name: "Name" }, { name: "ID" }] };
    const base = {
      targetId: "sheet",
      mode: "upsert" as const,
      keyField: "ID",
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
        keyField: "ID",
        mapping: [
          { columnId: "name", field: "Name" },
          { columnId: "due", field: null },
        ],
      }),
      { keyProperty: "ID", properties: { name: "Name" } }
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
    assert.equal(pushed[0]?.settings.keyField, "ID");
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
        describe: () => ({ fields: [{ name: "Name" }, { name: "ID" }] }),
        load: () => ({
          targetId: "remembered",
          mode: "upsert",
          keyField: "ID",
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

  test("an account connects before listing, a picker selects, an expired account reconnects", async () => {
    let connected = false;
    let listed = 0;
    let expired = false;
    const flow = model.createConnectorFlow({
      connector: {
        account: {
          status: () =>
            connected ? { connected, label: "ada@example.com" } : { connected },
          connect: () => {
            connected = true;
          },
          disconnect: () => {
            connected = false;
          },
        },
        targets: () => {
          listed += 1;
          return expired
            ? Promise.reject({ error: { code: "unauthorized" } })
            : Promise.resolve([]);
        },
        pickTarget: {
          pick: () => ({
            id: "picked",
            label: "Budget",
            children: [{ id: "0", label: "Sheet1" }],
          }),
        },
        describe: () => ({ fields: [{ name: "Name" }] }),
        push: () => result(),
      },
      context: {},
      columns,
      selectedCount: 0,
      t: en,
      pushContext: (scope) => ({ scope }),
      onChange: () => undefined,
    });
    await flow.start();
    assert.deepEqual(flow.state.account, { connected: false });
    assert.equal(listed, 0);
    assert.equal(en("connectAccount"), "Connect your account");

    await flow.connectAccount();
    assert.deepEqual(flow.state.account, {
      connected: true,
      label: "ada@example.com",
    });
    assert.equal(listed, 1);

    await flow.pickTarget();
    assert.equal(flow.state.targetId, "picked");
    assert.equal(flow.state.childId, "0");
    assert.equal(flow.state.targets.at(-1)?.label, "Budget");

    await flow.disconnectAccount();
    assert.deepEqual(flow.state.account, { connected: false });
    assert.equal(flow.state.targetId, "");
    assert.deepEqual(flow.state.targets, []);

    connected = true;
    expired = true;
    await flow.connectAccount();
    assert.deepEqual(flow.state.account, { connected: false });
    assert.equal(flow.state.error, en("error_unauthorized"));
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
    // The column-mapping component receives settings, rows, key, then the rest.
    const sections = model.connectorMappingSections(fields);
    assert.deepEqual(
      sections.before.map((field) => field.id),
      ["target", "child", "columns"]
    );
    assert.deepEqual(
      sections.rows.map((row) => [row.id, row.label]),
      [
        ["map:name", "Name"],
        ["map:due", "Échéance"],
        ["map:status", "Status"],
        ["map:price", "Price"],
      ]
    );
    assert.equal(sections.rows[0]?.heading, "Send each column to");
    assert.equal(sections.keyField?.id, "keyField");
    assert.deepEqual(
      sections.after.map((field) => field.id),
      ["mode", "scope"]
    );
    assert.equal(
      fields.find((field) => field.id === "scope")?.options.at(-1)?.label,
      "Selected (2)"
    );
    assert.equal(flow.state.scope, "view");
  });

  test("a connector without languages shows no Language select and sends no locale", async () => {
    const saved: Model.ConnectorSettings[] = [];
    const connector = {
      labels: { target: "Sheet" },
      targets: () => [{ id: "sheet", label: "Sheet" }],
      describe: () => ({ fields: [{ name: "Name" }], allowNewFields: true }),
      save: (settings: Model.ConnectorSettings) => {
        saved.push(settings);
      },
      push: () => result(),
    };
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
    const options = { connector, columns, selectedCount: 0, t: en };
    const ids = () =>
      model.connectorScreenFields(flow.state, options).map((field) => field.id);
    assert.equal(flow.state.locale, undefined);
    assert.ok(!ids().includes("language"));
    await flow.selectTarget("sheet");
    assert.ok(!ids().includes("language"));
    assert.equal(
      flow.state.settings ? "locale" in flow.state.settings : true,
      false
    );
    assert.deepEqual(
      flow.state.settings?.mapping.map((entry) => entry.field),
      ["Name", "Échéance", "Status", "Price"]
    );
    await flow.send();
    assert.equal(saved.length, 1);
    assert.equal("locale" in (saved[0] ?? {}), false);
  });

  test("languages: new fields are proposed in the chosen language, existing fields and typed names stay", async () => {
    const languageColumns = [
      { id: "name", header: "Name", type: "text", visible: true },
      { id: "status", header: "Status", type: "text", visible: true },
      { id: "notes", header: "Notes", type: "text", visible: true },
      { id: "owner", header: "Owner", type: "text", visible: true },
    ];
    const french: Record<string, string> = {
      name: "Nom",
      status: "Statut",
      notes: "Remarques",
      owner: "Responsable",
    };
    const saved: Model.ConnectorSettings[] = [];
    const pushed: Model.ConnectorSettings[] = [];
    const connector = {
      languages: {
        options: [
          { value: "en", label: "English" },
          { value: "fr", label: "Français" },
        ],
        default: "fr",
        headers: (locale: string) => (locale === "fr" ? french : undefined),
      },
      targets: () => [{ id: "sheet", label: "Sheet" }],
      describe: () => ({
        fields: [{ name: "Name" }, { name: "Statut" }],
        allowNewFields: true,
      }),
      save: (settings: Model.ConnectorSettings) => {
        saved.push(settings);
      },
      push: (settings: Model.ConnectorSettings) => {
        pushed.push(settings);
        return result({ created: 1 });
      },
    };
    const flow = model.createConnectorFlow({
      connector,
      context: {},
      columns: languageColumns,
      selectedCount: 0,
      t: fr,
      pushContext: (scope) => ({ scope }),
      onChange: () => undefined,
    });
    await flow.start();
    assert.equal(flow.state.locale, "fr");
    const options = {
      connector,
      columns: languageColumns,
      selectedCount: 0,
      t: fr,
    };
    const field = (id: string) =>
      model
        .connectorScreenFields(flow.state, options)
        .find((item) => item.id === id);
    // Chosen before a target too.
    assert.deepEqual(field("language"), {
      id: "language",
      label: "Langue",
      value: "fr",
      options: [
        { value: "en", label: "English" },
        { value: "fr", label: "Français" },
      ],
    });
    await flow.selectTarget("sheet");
    const fieldsOf = () =>
      flow.state.settings?.mapping.map((entry) => entry.field);
    // "Name" and "Statut" exist in the sheet; the others are new, in French.
    assert.deepEqual(fieldsOf(), [
      "Name",
      "Statut",
      "Remarques",
      "Responsable",
    ]);
    assert.equal(flow.state.settings?.locale, "fr");
    assert.deepEqual(
      model
        .connectorScreenFields(flow.state, options)
        .map((item) => item.id)
        .slice(0, 3),
      ["target", "columns", "language"]
    );
    assert.deepEqual(
      model
        .connectorMappingSections(
          model.connectorScreenFields(flow.state, options)
        )
        .before.map((item) => item.id),
      ["target", "columns", "language"]
    );
    assert.ok(
      field("map:notes")?.options.some(
        (option) =>
          option.value === "Remarques" &&
          option.label === "Nouveau champ « Remarques »"
      )
    );
    assert.equal(en("language"), "Language");

    // A name typed by hand never follows the language.
    flow.setField("owner", "Chef de projet");
    await model.applyConnectorField(flow, "language", "en");
    assert.equal(flow.state.locale, "en");
    assert.equal(flow.state.settings?.locale, "en");
    assert.deepEqual(fieldsOf(), ["Name", "Statut", "Notes", "Chef de projet"]);
    assert.ok(
      field("map:notes")?.options.some(
        (option) =>
          option.value === "Notes" && option.label === "Nouveau champ « Notes »"
      )
    );
    // A language that is not offered changes nothing.
    flow.setLocale("de");
    assert.equal(flow.state.settings?.locale, "en");

    await flow.send();
    assert.equal(flow.state.phase, "result");
    assert.equal(saved[0]?.locale, "en");
    assert.equal(pushed[0]?.locale, "en");
    assert.deepEqual(
      pushed[0]?.mapping.map((entry) => entry.field),
      ["Name", "Statut", "Notes", "Chef de projet"]
    );

    // Back to French: proposed names follow, duplicates are still reported.
    flow.edit();
    await model.applyConnectorField(flow, "language", "fr");
    assert.deepEqual(fieldsOf(), [
      "Name",
      "Statut",
      "Remarques",
      "Chef de projet",
    ]);
    flow.setField("owner", "Remarques");
    await flow.send();
    assert.equal(flow.state.error, "« Remarques » reçoit plusieurs colonnes.");
    assert.equal(pushed.length, 1);
  });

  test("languages: the saved locale wins, then the default, then the first option", async () => {
    const languages = {
      options: [
        { value: "en", label: "English" },
        { value: "fr", label: "Français" },
      ],
      headers: (locale: string) =>
        locale === "fr" ? { status: "Statut" } : undefined,
    };
    const flowWith = (
      saved: Partial<Model.ConnectorSettings> | null,
      extra: Partial<Model.ConnectorLanguages> = {}
    ) =>
      model.createConnectorFlow({
        connector: {
          languages: { ...languages, ...extra },
          targets: () => [{ id: "sheet", label: "Sheet" }],
          describe: () => ({ fields: [], allowNewFields: true }),
          load: () =>
            saved
              ? {
                  targetId: "sheet",
                  mode: "upsert",
                  keyField: "ID",
                  mapping: [],
                  ...saved,
                }
              : null,
          push: () => result(),
        },
        context: {},
        columns,
        selectedCount: 0,
        t: en,
        pushContext: (scope) => ({ scope }),
        onChange: () => undefined,
      });
    const remembered = flowWith({ locale: "fr" }, { default: "en" });
    await remembered.start();
    assert.equal(remembered.state.settings?.locale, "fr");
    assert.equal(
      remembered.state.settings?.mapping.find(
        (entry) => entry.columnId === "status"
      )?.field,
      "Statut"
    );
    const byDefault = flowWith({}, { default: "fr" });
    await byDefault.start();
    assert.equal(byDefault.state.settings?.locale, "fr");
    const first = flowWith(null);
    await first.start();
    assert.equal(first.state.locale, "en");
    // One language: sent as the locale, no select.
    const single = model.resolveConnectorSettings({
      columns,
      schema: { fields: [], allowNewFields: true },
      target: { targetId: "sheet" },
      languages: {
        options: [{ value: "fr", label: "Français" }],
        headers: () => ({ status: "Statut" }),
      },
    });
    assert.equal(single.locale, "fr");
    assert.equal(
      single.mapping.find((entry) => entry.columnId === "status")?.field,
      "Statut"
    );
  });

  test("languages: a target created from the table's columns uses the chosen language", async () => {
    const created: Model.ConnectorNewTargetColumn[][] = [];
    const flow = model.createConnectorFlow({
      connector: {
        languages: {
          options: [
            { value: "en", label: "English" },
            { value: "fr", label: "Français" },
          ],
          headers: (locale: string) =>
            locale === "fr" ? { name: "Nom", due: "Date limite" } : undefined,
        },
        targets: () => [],
        describe: () => ({ fields: [{ name: "Nom" }], allowNewFields: true }),
        createTarget: {
          create: (input) => {
            created.push(input.columns);
            return { id: "new", label: input.title };
          },
        },
        push: () => result(),
      },
      context: {},
      columns,
      selectedCount: 0,
      t: en,
      pushContext: (scope) => ({ scope }),
      onChange: () => undefined,
    });
    await flow.start();
    assert.equal(flow.state.locale, "en");
    await model.applyConnectorField(flow, "language", "fr");
    assert.equal(flow.state.locale, "fr");
    await flow.createTarget({ title: "Projets" });
    assert.deepEqual(
      created[0]?.map((column) => column.header),
      ["Nom", "Date limite", "Status"]
    );
    assert.equal(flow.state.settings?.locale, "fr");
    assert.deepEqual(
      flow.state.settings?.mapping.map((entry) => entry.field),
      ["Nom", "Date limite", "Status", "Price"]
    );
  });
}
