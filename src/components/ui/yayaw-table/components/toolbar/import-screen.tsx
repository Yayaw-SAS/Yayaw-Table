"use client";

import type { ReactNode } from "react";
import type { TableActions } from "../../providers/table-provider";
import type { DataDestinationContext } from "../../utils/data-destinations";
import {
  fetchAllFilteredRows,
  type TableListAction,
} from "../../utils/filtered-rows";
import {
  type ImportTranslate,
  importColumnsFrom,
  importLabels,
  isImportEnabled,
} from "../../utils/import-flow";
import {
  existingLookupFromRows,
  type ImportAdapters,
} from "../../utils/import-model";
import { ImportPanel } from "./import-panel";

type Row = Record<string, unknown>;

export interface ImportScreenOptions {
  /** `table.import` (default true) and `allowEdit`. */
  table: { import?: boolean; allowEdit?: boolean };
  actions?: TableActions;
  canCreate: boolean;
  columns: readonly {
    id: string;
    header?: unknown;
    type?: unknown;
    options?: unknown;
    numberFormat?: unknown;
  }[];
  locale: string;
  t: (key: string) => string;
  context: () => DataDestinationContext;
  /** The rows the table holds, used without a `list` action. */
  rows?: readonly Row[];
  /** The table instance options, for `getRowId`. */
  tableOptions?: unknown;
  onImported: () => void;
}

/** Every record of the table, whatever the view shows. */
const loadAllRows = async (options: ImportScreenOptions): Promise<Row[]> => {
  const list = options.actions?.list;
  if (!list) {
    return [...(options.rows ?? [])];
  }
  return await fetchAllFilteredRows({
    advancedFilters: [],
    filters: {},
    listAction: list as TableListAction,
    pageSize: 100,
    search: "",
  });
};

/** The table's own row id, else the record's `id`. */
const rowIdOf =
  (options: ImportScreenOptions) =>
  (row: Row, index: number): string => {
    const getRowId = (
      options.tableOptions as
        | { getRowId?: (row: Row, index: number) => string }
        | undefined
    )?.getRowId;
    return getRowId ? getRowId(row, index) : String(row.id ?? index);
  };

const canUpdate = (options: ImportScreenOptions): boolean =>
  options.table.allowEdit !== false &&
  typeof options.actions?.update === "function";

/** Record ids by key value: the host's `lookup`, or the table's own rows. */
const findExisting =
  (options: ImportScreenOptions) =>
  async (columnId: string, keys: string[]) => {
    const lookup = options.actions?.import?.lookup;
    if (lookup) {
      const ids = await lookup({ columnId, keys });
      return (key: string) => ids[key];
    }
    return existingLookupFromRows(
      await loadAllRows(options),
      columnId,
      rowIdOf(options)
    );
  };

const adaptersFor = (options: ImportScreenOptions): ImportAdapters => {
  const { actions } = options;
  const importRows = actions?.import?.importRows;
  const create = options.canCreate ? actions?.create : undefined;
  const update = canUpdate(options) ? actions?.update : undefined;
  return {
    ...(importRows
      ? { importRows: (batch) => importRows(batch, options.context()) }
      : {}),
    ...(create ? { create: (values) => create(values) } : {}),
    ...(update ? { update: (id, values) => update(id, values) } : {}),
  };
};

/**
 * The Data › Import entry: whether it shows, its label and its screen. It
 * shows when the table can create or update rows (or the host imports in
 * bulk) and `table.import` is not false.
 */
export function importScreen(options: ImportScreenOptions): {
  /** The Data menu entry's label, when Import shows. */
  menuLabel: string | undefined;
  screens: { name: string; title: string; content: ReactNode }[];
} {
  const config = options.actions?.import;
  const translate: ImportTranslate = (key, fallback) => {
    const translated = options.t(`import.${key}`);
    return translated === `import.${key}` ? fallback : translated;
  };
  const enabled = isImportEnabled({
    flag: options.table.import,
    canCreate: options.canCreate,
    canUpdate: canUpdate(options),
    hasImportRows: Boolean(config?.importRows),
  });
  if (!enabled) {
    return { menuLabel: undefined, screens: [] };
  }
  const sources = config?.sources ?? [];
  const title = importLabels(options.locale, translate)("title");
  const content = (
      <ImportPanel
        adapters={adaptersFor(options)}
        allowNewOptions={config?.allowNewOptions}
        batchSize={config?.batchSize}
        columns={importColumnsFrom(options.columns)}
        csv={config?.csv}
        findExisting={findExisting(options)}
        loadSource={async (id) => {
          const source = sources.find((item) => item.id === id);
          if (!source) {
            throw new Error(`Unknown import source: ${id}`);
          }
          return await source.load(options.context());
        }}
        locale={options.locale}
        onImported={options.onImported}
        sources={sources.map(({ id, label, description }) => ({
          id,
          label,
          description,
        }))}
        translate={translate}
      />
  );
  return { menuLabel: title, screens: [{ name: "import", title, content }] };
}
