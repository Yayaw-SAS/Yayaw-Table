import type {
  ConnectorPushResult,
  ConnectorSchema,
  ConnectorSettings,
  ConnectorTarget,
  ConnectorTargetRef,
} from "../src/components/ui/yayaw-table/utils/connector-flow";

/**
 * An in-memory "Spreadsheet" connector for the React and Vue examples, so the
 * connector screens can be tried without a network. A real host implements
 * the same functions with server functions calling a connector server module
 * (Google Sheets, Notion) with credentials it stores itself.
 */

const SERVICE_ACCOUNT = "yayaw-demo@yayaw-demo.iam.gserviceaccount.com";
const SPREADSHEET_LINK = /\/spreadsheets\/d\/([\w-]{6,})/;
const PRIVATE_SHEET = "private-sheet";

export interface Sheet {
  headers: string[];
  rows: Map<string, Record<string, unknown>>;
}

export interface PushContext {
  viewId: string | null;
  loadRows: () => Promise<Record<string, unknown>[]>;
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

export function createSpreadsheetConnector() {
  const targets: ConnectorTarget[] = [
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
        headers: [
          "Yayaw ID",
          "Name",
          "Category",
          "Status",
          "Price",
          "Due date",
        ],
        rows: new Map(),
      },
    ],
    ["team-tracker/archive", { headers: [], rows: new Map() }],
  ]);
  // The settings each view remembers; a real host stores them with the view.
  const remembered = new Map<string, ConnectorSettings>();
  const keyOf = (viewId: string | null) => String(viewId ?? "default");
  const sheetOf = (target: ConnectorTargetRef): Sheet => {
    if (target.targetId === PRIVATE_SHEET) {
      throw connectorError("not_shared", {
        serviceAccountEmail: SERVICE_ACCOUNT,
      });
    }
    const key = `${target.targetId}/${target.childId ?? "sheet1"}`;
    const sheet = sheets.get(key) ?? { headers: [], rows: new Map() };
    sheets.set(key, sheet);
    return sheet;
  };

  const push = async (
    settings: ConnectorSettings,
    context: PushContext
  ): Promise<ConnectorPushResult> => {
    const sheet = sheetOf(settings);
    const records = await context.loadRows();
    const mapped = settings.mapping.filter((entry) => entry.field);
    for (const field of [
      settings.keyField,
      ...mapped.map((entry) => String(entry.field)),
    ]) {
      if (!sheet.headers.includes(field)) {
        sheet.headers.push(field);
      }
    }
    if (settings.mode === "replace") {
      sheet.rows.clear();
    }
    const result: ConnectorPushResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      failures: [],
      warnings: [],
      warningCount: 0,
      truncated: false,
    };
    for (const record of records) {
      const id = String(record.id ?? "");
      const values: Record<string, unknown> = { [settings.keyField]: id };
      for (const entry of mapped) {
        values[String(entry.field)] = record[entry.columnId];
      }
      if (sheet.rows.has(id)) {
        result.updated += 1;
      } else {
        result.created += 1;
      }
      sheet.rows.set(id, values);
    }
    return result;
  };

  return {
    id: "spreadsheet",
    label: "Spreadsheet",
    kind: "connect" as const,
    connector: {
      labels: { target: "Spreadsheet", child: "Tab" },
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
      describe: (target: ConnectorTargetRef): Promise<ConnectorSchema> => {
        try {
          const sheet = sheetOf(target);
          return Promise.resolve({
            fields: sheet.headers.map((name) => ({ name })),
            keyFields:
              sheet.headers.length > 0 ? [...sheet.headers] : undefined,
            allowNewFields: true,
          });
        } catch (error) {
          return Promise.reject(error);
        }
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
      help: {
        notShared: (details: { serviceAccountEmail?: string }) =>
          `Share the spreadsheet with ${details.serviceAccountEmail ?? "the connection"} as an editor, then send again.`,
      },
    },
  };
}
