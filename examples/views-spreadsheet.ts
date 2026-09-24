import {
  applyConflictResolutions,
  applySyncPlan,
  planSync,
  resolvePendingConflicts,
  type SyncMapping,
  type SyncRecord,
  type SyncSideAdapter,
  type SyncState,
  toSyncMapping,
} from "../src/components/ui/yayaw-table/connectors/sync-engine";
import {
  type ConflictRule,
  type ConnectorPushResult,
  type ConnectorSchema,
  type ConnectorSettings,
  type ConnectorTarget,
  type ConnectorTargetRef,
  type PendingConflictResolution,
  type SyncDirection,
  toPendingConflicts,
  toSyncPreview,
  toSyncRunResult,
} from "../src/components/ui/yayaw-table/utils/connector-flow";
import type { ScheduleSettings } from "../src/components/ui/yayaw-table/utils/schedule-model";

/**
 * An in-memory "Spreadsheet" connector for the React and Vue examples, so the
 * connector screens can be tried without a network. A real host implements
 * the same functions with server functions calling a connector server module
 * (Google Sheets, Notion) and the sync engine, with credentials and sync
 * state it stores itself. The demo runs the real sync engine in the browser.
 */

const SERVICE_ACCOUNT = "yayaw-demo@yayaw-demo.iam.gserviceaccount.com";
const SPREADSHEET_LINK = /\/spreadsheets\/d\/([\w-]{6,})/;
const PRIVATE_SHEET = "private-sheet";
const LIVE_SHEET = "live-projects/projects";
const KEY_FIELD = "Yayaw ID";

/** A tab: its header row and its rows, cells by header. */
export interface Sheet {
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface PushContext {
  viewId: string | null;
  loadRows: () => Promise<Record<string, unknown>[]>;
}

/** The table side of a sync: the host's own records, not the view's rows. */
export interface DemoTable {
  columns: readonly { id: string; type?: string }[];
  rows: () => Record<string, unknown>[];
  create: (values: Record<string, unknown>) => string;
  update: (id: string, values: Record<string, unknown>) => boolean;
  remove: (id: string) => boolean;
}

/** Errors carry a typed code, like the connector server modules' `ConnectorError`. */
const connectorError = (
  code: string,
  details: Record<string, unknown> = {}
): Error =>
  Object.assign(new Error(`Connector request failed: ${code}`), {
    code,
    details,
  });

const text = (value: unknown) => String(value ?? "").trim();

/** Sheet rows as sync records: the key cell is the remote id, else the row number. */
const readSheet = (sheet: Sheet, mapping: SyncMapping): SyncRecord[] =>
  sheet.rows.map((row, index) => {
    const key = text(row[mapping.keyField ?? KEY_FIELD]);
    const values: Record<string, unknown> = {};
    for (const field of mapping.fields) {
      if (sheet.headers.includes(field.field)) {
        values[field.columnId] = row[field.field] ?? null;
      }
    }
    return {
      id: key || `row:${index + 2}`,
      ...(key ? { key } : {}),
      values,
    };
  });

const addHeaders = (sheet: Sheet, names: readonly string[]) => {
  for (const name of names) {
    if (!sheet.headers.includes(name)) {
      sheet.headers.push(name);
    }
  }
};

/** Writes a sheet like the Google Sheets sync target: by key, deletes by key only. */
const sheetAdapter = (sheet: Sheet, mapping: SyncMapping): SyncSideAdapter => {
  const keyField = mapping.keyField ?? KEY_FIELD;
  const header = new Map(
    mapping.fields.map((field) => [field.columnId, field.field])
  );
  const cells = (values: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(values).flatMap(([columnId, value]) => {
        const name = header.get(columnId);
        return name ? [[name, value]] : [];
      })
    );
  const find = (id: string) =>
    id.startsWith("row:")
      ? sheet.rows[Number(id.slice(4)) - 2]
      : sheet.rows.find((row) => text(row[keyField]) === id);
  addHeaders(sheet, [keyField, ...mapping.fields.map((field) => field.field)]);
  return {
    create: (items) => {
      for (const item of items) {
        sheet.rows.push({ [keyField]: item.key, ...cells(item.values) });
      }
      return Promise.resolve(items.map((item) => ({ ok: true, id: item.key })));
    },
    update: (items) =>
      Promise.resolve(
        items.map((item) => {
          const row = find(item.id ?? "");
          if (!row) {
            return { ok: false as const, code: "not_found" as const };
          }
          Object.assign(row, cells(item.values));
          if (item.key) {
            row[keyField] = item.key;
          }
          return { ok: true as const, id: text(row[keyField]) || item.id };
        })
      ),
    delete: (ids) => {
      const gone = new Set(ids);
      sheet.rows = sheet.rows.filter((row) => !gone.has(text(row[keyField])));
      return Promise.resolve(ids.map(() => ({ ok: true as const })));
    },
  };
};

const tableAdapter = (table: DemoTable): SyncSideAdapter => ({
  create: (items) =>
    Promise.resolve(
      items.map((item) => ({
        ok: true as const,
        id: table.create(item.values),
      }))
    ),
  update: (items) =>
    Promise.resolve(
      items.map((item) =>
        table.update(item.id ?? "", item.values)
          ? { ok: true as const }
          : { ok: false as const, code: "not_found" as const }
      )
    ),
  delete: (ids) =>
    Promise.resolve(
      ids.map((id) =>
        table.remove(id)
          ? { ok: true as const }
          : { ok: false as const, code: "not_found" as const }
      )
    ),
});

const LIVE_HEADERS = [
  KEY_FIELD,
  "Name",
  "Category",
  "Status",
  "Price",
  "Progress",
  "Due",
  "Site",
];

const LIVE_MAPPING: SyncMapping = {
  keyField: KEY_FIELD,
  fields: [
    { columnId: "name", field: "Name", type: "text" },
    { columnId: "category", field: "Category", type: "select" },
    { columnId: "status", field: "Status", type: "select" },
    { columnId: "price", field: "Price", type: "number" },
    { columnId: "progress", field: "Progress", type: "number" },
    { columnId: "dueDate", field: "Due", type: "date" },
    // Places travel as "lat, lng" text, as with Google Sheets.
    { columnId: "site", field: "Site", type: "location" },
  ],
};

const rowOf = (sheet: Sheet, key: string) =>
  sheet.rows.find((row) => row[KEY_FIELD] === key);

/**
 * The rules the "Live projects" host applies in code: the sheet owns prices,
 * a person decides status conflicts and the table wins names. A real host
 * passes the same objects to `planSync` on its server and declares them on
 * the connector so the screen shows them.
 */
const LIVE_RULES = {
  ownership: { price: "target" },
  columnRules: { status: "manual", name: "table-wins" },
} as const;

/**
 * "Live projects" was synced once with the table (Charlie was 350, Alpha
 * "Draft" and Bravo "Archived" then), then edited on both sides: Alpha's and
 * Bravo's statuses changed on both sides (left to a person), Foxtrot's price
 * changed in the sheet, Charlie's price changed on both sides (the sheet owns
 * prices), Delta was deleted from the sheet, Echo's key was copied to a
 * second row (a duplicate) and two rows were added in the sheet without a key.
 */
async function seedLiveSheet(table: DemoTable): Promise<{
  sheet: Sheet;
  state: SyncState;
}> {
  const sheet: Sheet = { headers: [...LIVE_HEADERS], rows: [] };
  const before: Record<string, Record<string, unknown>> = {
    alpha: { status: "Draft" },
    bravo: { status: "Archived" },
    charlie: { price: 350 },
  };
  const baseline = table.rows().map((row) => ({
    id: String(row.id),
    values: { ...row, ...before[String(row.id)] },
  }));
  const plan = planSync({
    direction: "push",
    mapping: LIVE_MAPPING,
    tableRecords: baseline,
    targetRecords: [],
    now: "2026-09-01T09:00:00.000Z",
  });
  const { state } = await applySyncPlan(plan, {
    target: sheetAdapter(sheet, LIVE_MAPPING),
  });
  Object.assign(rowOf(sheet, "alpha") ?? {}, { Status: "Archived" });
  Object.assign(rowOf(sheet, "bravo") ?? {}, { Status: "Active" });
  Object.assign(rowOf(sheet, "foxtrot") ?? {}, { Price: 25 });
  Object.assign(rowOf(sheet, "charlie") ?? {}, { Price: 420 });
  sheet.rows = sheet.rows.filter((row) => row[KEY_FIELD] !== "delta");
  sheet.rows.push(
    { ...rowOf(sheet, "echo"), Name: "Echo sensors (copy)" },
    {
      Name: "Golf kiosk",
      Category: "Hardware",
      Status: "Draft",
      Price: 240,
      Progress: 0.1,
      Due: "2026-09-21",
    },
    {
      Name: "Hotel booking",
      Category: "Service",
      Status: "Active",
      Price: 60,
      Progress: 0.6,
      Due: "2026-09-24",
    }
  );
  return { sheet, state };
}

const emptyPushResult = (): ConnectorPushResult => ({
  created: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  failures: [],
  warnings: [],
  warningCount: 0,
  truncated: false,
});

export function createSpreadsheetConnector(table: DemoTable) {
  const targets: ConnectorTarget[] = [
    {
      id: "live-projects",
      label: "Live projects",
      description: "Edited by the team",
      children: [{ id: "projects", label: "Projects" }],
    },
    {
      id: "team-tracker",
      label: "Team tracker",
      description: "Shared drive",
      children: [
        { id: "projects", label: "Projects" },
        { id: "archive", label: "Archive" },
      ],
    },
    {
      id: PRIVATE_SHEET,
      label: "Private sheet",
      children: [{ id: "sheet1", label: "Sheet1" }],
    },
  ];
  const sheets = new Map<string, Sheet>([
    [
      "team-tracker/projects",
      {
        headers: [KEY_FIELD, "Name", "Category", "Status", "Price", "Due date"],
        rows: [],
      },
    ],
    ["team-tracker/archive", { headers: [], rows: [] }],
  ]);
  // What each tab held after its last sync; a real host stores it per view.
  const states = new Map<string, SyncState>();
  const live = seedLiveSheet(table).then(({ sheet, state }) => {
    sheets.set(LIVE_SHEET, sheet);
    states.set(LIVE_SHEET, state);
  });
  // The settings each view remembers; a real host stores them with the view.
  const remembered = new Map<string, ConnectorSettings>();
  const schedules = new Map<string, ScheduleSettings>();
  const keyOf = (viewId: string | null) => String(viewId ?? "default");
  const tabOf = (target: ConnectorTargetRef) =>
    `${target.targetId}/${target.childId ?? "sheet1"}`;
  const sheetOf = async (target: ConnectorTargetRef): Promise<Sheet> => {
    if (target.targetId === PRIVATE_SHEET) {
      throw connectorError("not_shared", {
        serviceAccountEmail: SERVICE_ACCOUNT,
      });
    }
    await live;
    const key = tabOf(target);
    const sheet = sheets.get(key) ?? { headers: [], rows: [] };
    sheets.set(key, sheet);
    return sheet;
  };

  const push = async (
    settings: ConnectorSettings,
    context: PushContext
  ): Promise<ConnectorPushResult> => {
    const sheet = await sheetOf(settings);
    const records = await context.loadRows();
    const mapped = settings.mapping.filter((entry) => entry.field);
    addHeaders(sheet, [
      settings.keyField,
      ...mapped.map((entry) => String(entry.field)),
    ]);
    if (settings.mode === "replace") {
      sheet.rows = [];
    }
    const result = emptyPushResult();
    for (const record of records) {
      const id = String(record.id ?? "");
      const values: Record<string, unknown> = { [settings.keyField]: id };
      for (const entry of mapped) {
        values[String(entry.field)] = record[entry.columnId];
      }
      const row = sheet.rows.find(
        (item) => text(item[settings.keyField]) === id
      );
      if (row) {
        Object.assign(row, values);
        result.updated += 1;
      } else {
        sheet.rows.push(values);
        result.created += 1;
      }
    }
    return result;
  };

  /** Reads both sides and plans the sync the settings describe. */
  const plan = async (settings: ConnectorSettings) => {
    const sheet = await sheetOf(settings);
    const mapping = toSyncMapping(settings, table.columns);
    const tableRecords = table.rows().map((row) => ({
      id: String(row.id),
      values: row,
    }));
    return {
      sheet,
      mapping,
      plan: planSync({
        direction: settings.direction ?? "push",
        conflictRule: settings.conflictRule,
        deletePolicy: settings.deletePolicy,
        mapping,
        tableRecords,
        targetRecords: readSheet(sheet, mapping),
        state: states.get(tabOf(settings)),
        // Only "Live projects" has rules; other tabs use the chosen rule.
        ...(tabOf(settings) === LIVE_SHEET ? LIVE_RULES : {}),
      }),
    };
  };
  const rowLabel = (id: string) => {
    const row = table.rows().find((item) => String(item.id) === id);
    return row ? String(row.name) : undefined;
  };

  /** Conflicts a sync left to a person, from the tab's sync state. */
  const listConflicts = async (settings: ConnectorSettings) => {
    await sheetOf(settings);
    return toPendingConflicts(states.get(tabOf(settings))?.pendingConflicts, {
      rowLabel,
    });
  };

  /** Writes the person's choices to both sides and saves the new state. */
  const resolveConflicts = async (
    resolutions: PendingConflictResolution[],
    settings: ConnectorSettings
  ) => {
    const sheet = await sheetOf(settings);
    const mapping = toSyncMapping(settings, table.columns);
    const resolution = resolvePendingConflicts(
      states.get(tabOf(settings)) ?? { links: [] },
      resolutions,
      { mapping }
    );
    const result = await applyConflictResolutions(resolution, {
      table: tableAdapter(table),
      target: sheetAdapter(sheet, mapping),
    });
    states.set(tabOf(settings), result.state);
    return toSyncRunResult(result);
  };

  return {
    id: "spreadsheet",
    label: "Spreadsheet",
    kind: "connect" as const,
    // The clock schedules the saved settings: a push or a two-way sync.
    schedule: {
      load: (context: { viewId: string | null }) =>
        Promise.resolve(schedules.get(keyOf(context.viewId)) ?? null),
      save: (
        settings: ScheduleSettings,
        context: { viewId: string | null }
      ) => {
        schedules.set(keyOf(context.viewId), settings);
        return Promise.resolve();
      },
    },
    connector: {
      labels: { target: "Spreadsheet", child: "Tab" },
      directions: ["push", "pull", "two-way"] as SyncDirection[],
      // Sheet rows have no edit time: "Latest edit wins" would act as "Table wins".
      conflictRules: ["table-wins", "target-wins"] as ConflictRule[],
      // Shown on the screen; the rules themselves run in `plan` below.
      conflicts: { ...LIVE_RULES, lock: true },
      listConflicts,
      resolveConflicts,
      targets: () => Promise.resolve(targets),
      allowTargetInput: {
        label: "Or paste a spreadsheet link",
        placeholder: "https://docs.google.com/spreadsheets/d/…",
        resolve: (input: string) => {
          const id = SPREADSHEET_LINK.exec(input)?.[1];
          if (!id) {
            return Promise.reject(connectorError("invalid_target"));
          }
          const target = {
            id,
            label: `Spreadsheet ${id.slice(0, 6)}`,
            children: [{ id: "sheet1", label: "Sheet1" }],
          };
          targets.push(target);
          return Promise.resolve(target);
        },
      },
      describe: async (
        target: ConnectorTargetRef
      ): Promise<ConnectorSchema> => {
        const sheet = await sheetOf(target);
        return {
          fields: sheet.headers.map((name) => ({
            name,
            sample: sheet.rows.slice(0, 20).map((row) => row[name]),
          })),
          keyFields: sheet.headers.length > 0 ? [...sheet.headers] : undefined,
          allowNewFields: true,
        };
      },
      modes: ["upsert", "replace"] as ("upsert" | "replace")[],
      load: (context: { viewId: string | null }) =>
        Promise.resolve(remembered.get(keyOf(context.viewId)) ?? null),
      save: (
        settings: ConnectorSettings,
        context: { viewId: string | null }
      ) => {
        remembered.set(keyOf(context.viewId), settings);
        return Promise.resolve();
      },
      push,
      preview: async (settings: ConnectorSettings) =>
        toSyncPreview((await plan(settings)).plan, { rowLabel }),
      sync: async (settings: ConnectorSettings) => {
        const planned = await plan(settings);
        const result = await applySyncPlan(planned.plan, {
          table: tableAdapter(table),
          target: sheetAdapter(planned.sheet, planned.mapping),
        });
        states.set(tabOf(settings), result.state);
        return toSyncRunResult(result, planned.plan);
      },
      help: {
        notShared: (details: { serviceAccountEmail?: string }) =>
          `Share the spreadsheet with ${details.serviceAccountEmail ?? "the connection"} as an editor, then send again.`,
      },
    },
  };
}
