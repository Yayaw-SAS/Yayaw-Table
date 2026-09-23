import {
  type NotionDatabaseSchema,
  type NotionPropertySchema,
  planNotionDatabase,
  planNotionPrepare,
} from "../src/components/ui/yayaw-table/connectors/notion";
import type {
  ConnectorNewTargetColumn,
  ConnectorPushResult,
  ConnectorSchema,
  ConnectorSettings,
  ConnectorTarget,
  ConnectorTargetRef,
  SyncDirection,
} from "../src/components/ui/yayaw-table/utils/connector-flow";
import type { SchemaFix } from "../src/components/ui/yayaw-table/utils/connector-schema";

/**
 * An in-memory "Notion" connector for the React and Vue examples, so the
 * target check, "Prepare Notion database" and "Create one from this table’s
 * columns" can be tried without a network. A real host implements the same
 * functions with server functions calling `getNotionDatabaseSchema`,
 * `prepareNotionDatabase`, `createNotionDatabase` and
 * `pushRowsToNotionDatabase`; the demo uses their pure planners.
 *
 * "Live projects" drifted since its mapping was saved: "Price" was renamed
 * "Cost" (same property id), "Progress" became a Select (a number cannot go
 * there), "Category" lacks two of the table's options and "Yayaw ID" was
 * deleted.
 */

const KEY = "Yayaw ID";
const LIVE = "live-projects";

export interface NotionPushContext {
  viewId: string | null;
  loadRows: () => Promise<Record<string, unknown>[]>;
}

interface Database extends NotionDatabaseSchema {
  pages: Record<string, unknown>[];
}

const connectorError = (code: string): Error =>
  Object.assign(new Error(`Connector request failed: ${code}`), { code });

const options = (...names: string[]) => names.map((name) => ({ name }));

const liveProjects = (): Database => ({
  id: LIVE,
  title: "Live projects",
  url: null,
  pages: [],
  properties: [
    { id: "title", name: "Name", type: "title" },
    {
      id: "cat",
      name: "Category",
      type: "select",
      options: [
        { name: "Software", color: "blue" },
        { name: "Hardware", color: "orange" },
      ],
    },
    {
      id: "sts",
      name: "Status",
      type: "status",
      options: options("Active", "Draft", "Archived"),
    },
    { id: "prc", name: "Cost", type: "number" },
    {
      id: "prg",
      name: "Progress",
      type: "select",
      options: options("Started", "Done"),
    },
    { id: "due", name: "Due", type: "date" },
    { id: "mrg", name: "Margin", type: "formula" },
    { id: "own", name: "Owner", type: "people" },
  ],
});

/** What the default view saved before Notion drifted: names and property ids. */
const SAVED_LIVE: ConnectorSettings = {
  targetId: LIVE,
  mode: "upsert",
  keyField: KEY,
  keyFieldId: "key",
  columns: "visible",
  direction: "push",
  mapping: [
    { columnId: "name", field: "Name", fieldId: "title" },
    { columnId: "category", field: "Category", fieldId: "cat" },
    { columnId: "status", field: "Status", fieldId: "sts" },
    { columnId: "price", field: "Price", fieldId: "prc" },
    { columnId: "progress", field: "Progress", fieldId: "prg" },
    { columnId: "dueDate", field: "Due", fieldId: "due" },
  ],
};

const TEXT_KEY_TYPES = new Set(["title", "rich_text", "number"]);
const WRITABLE_TYPES = new Set([
  "title",
  "rich_text",
  "number",
  "select",
  "status",
  "multi_select",
  "date",
  "checkbox",
  "url",
  "email",
  "phone_number",
]);

const describeDatabase = (database: Database): ConnectorSchema => ({
  provider: "notion",
  fields: database.properties.map((property) => ({
    name: property.name,
    id: property.id,
    type: property.type,
    ...(property.options
      ? { options: property.options.map((option) => option.name) }
      : {}),
  })),
  // The key is always offered: the target check says when it is missing.
  keyFields: [
    KEY,
    ...database.properties
      .filter(
        (property) => TEXT_KEY_TYPES.has(property.type) && property.name !== KEY
      )
      .map((property) => property.name),
  ],
});

let nextId = 1;
const newId = () => {
  nextId += 1;
  return `p${nextId}`;
};

/** Properties of a planner's `{ [nameOrId]: { [type]: config } }` payload. */
const applyProperties = (
  database: Database,
  properties: Record<string, unknown>
) => {
  for (const [key, config] of Object.entries(properties)) {
    const [type, value] =
      Object.entries(config as Record<string, unknown>)[0] ?? [];
    if (!type) {
      continue;
    }
    const list = (value as { options?: { name: string; color?: string }[] })
      ?.options;
    const existing = database.properties.find(
      (property) => property.id === key || property.name === key
    );
    if (existing) {
      existing.options = list ?? existing.options;
    } else {
      database.properties.push({
        id: newId(),
        name: key,
        type,
        ...(list ? { options: list } : {}),
      });
    }
  }
};

const findProperty = (
  database: Database,
  name: string | null,
  id: string | undefined
): NotionPropertySchema | undefined =>
  (id
    ? database.properties.find((property) => property.id === id)
    : undefined) ??
  database.properties.find((property) => property.name === name);

const emptyResult = (): ConnectorPushResult => ({
  created: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  failures: [],
  warnings: [],
  warningCount: 0,
  truncated: false,
});

export function createNotionConnector() {
  const databases = new Map<string, Database>([[LIVE, liveProjects()]]);
  const parents = [
    { id: "team-home", label: "Team home" },
    { id: "projects-hub", label: "Projects hub" },
  ];
  // The settings each view remembers; a real host stores them with the view.
  const remembered = new Map<string, ConnectorSettings>();
  const keyOf = (viewId: string | null) => String(viewId ?? "default");
  const databaseOf = (id: string): Database => {
    const database = databases.get(id);
    if (!database) {
      throw connectorError("not_found");
    }
    return database;
  };
  const targets = (): ConnectorTarget[] =>
    [...databases.values()].map((database) => ({
      id: database.id,
      label: database.title,
    }));

  /** Writes pages like `pushRowsToNotionDatabase`: by property id first, keyed by "Yayaw ID". */
  const push = async (
    settings: ConnectorSettings,
    context: NotionPushContext
  ): Promise<ConnectorPushResult> => {
    const database = databaseOf(settings.targetId);
    const key = findProperty(database, settings.keyField, settings.keyFieldId);
    if (!(key && TEXT_KEY_TYPES.has(key.type))) {
      throw connectorError("invalid_mapping");
    }
    const result = emptyResult();
    const written = settings.mapping.flatMap((entry) => {
      const property = entry.field
        ? findProperty(database, entry.field, entry.fieldId)
        : undefined;
      return property && WRITABLE_TYPES.has(property.type)
        ? [{ columnId: entry.columnId, property }]
        : [];
    });
    for (const record of await context.loadRows()) {
      const id = String(record.id ?? "");
      const page: Record<string, unknown> = { [key.name]: id };
      for (const { columnId, property } of written) {
        page[property.name] = record[columnId];
      }
      const existing = database.pages.find((item) => item[key.name] === id);
      if (existing) {
        Object.assign(existing, page);
        result.updated += 1;
      } else {
        database.pages.push(page);
        result.created += 1;
      }
    }
    return result;
  };

  return {
    id: "notion",
    label: "Notion",
    kind: "connect" as const,
    connector: {
      labels: { target: "Database" },
      directions: ["push"] as SyncDirection[],
      targets: () => Promise.resolve(targets()),
      describe: (target: ConnectorTargetRef) =>
        Promise.resolve(describeDatabase(databaseOf(target.targetId))),
      load: (context: { viewId: string | null }) =>
        // Every view starts from the mapping saved before Notion drifted.
        Promise.resolve(remembered.get(keyOf(context.viewId)) ?? SAVED_LIVE),
      save: (
        settings: ConnectorSettings,
        context: { viewId: string | null }
      ) => {
        remembered.set(keyOf(context.viewId), settings);
        return Promise.resolve();
      },
      push,
      /** A real host calls `prepareNotionDatabase` on its server. */
      prepareTarget: (fixes: SchemaFix[], settings: ConnectorSettings) => {
        const database = databaseOf(settings.targetId);
        const plan = planNotionPrepare(database, fixes);
        applyProperties(database, plan.properties);
        return Promise.resolve({ applied: plan.applied as SchemaFix[] });
      },
      /** A real host lists pages with `listNotionPages` and calls `createNotionDatabase`. */
      createTarget: {
        label: "New database from this table’s columns…",
        parents: () => Promise.resolve(parents),
        create: (input: {
          parentId?: string;
          title: string;
          columns: ConnectorNewTargetColumn[];
        }) => {
          const id = `database-${newId()}`;
          const database: Database = {
            id,
            title: input.title,
            url: null,
            pages: [],
            properties: [],
          };
          applyProperties(
            database,
            planNotionDatabase(input.columns, KEY).properties
          );
          databases.set(id, database);
          return Promise.resolve({ id, label: input.title });
        },
      },
      help: {
        missingTarget:
          "Don’t see your database? In Notion, open its page, then ••• › Connections › add the Yayaw integration, and refresh the list.",
      },
    },
  };
}
