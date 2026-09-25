import type { Component, VNodeChild } from "vue";
import type { TableActions, TableConfig, TableView } from "../types";
import type {
  DashboardFilterValue,
  DashboardLabelKey,
  DashboardOpenViewContext,
  DashboardSetFilterResult,
} from "./dashboard-model";
import type {
  DashboardBlockSchema,
  DashboardJsonObject,
} from "./dashboard-schema";

/**
 * The props of the `YayawDataTable` a full-page `table` widget renders
 * (camelCase: `tableType`, `config`, `getTableActions`…).
 */
export type DashboardDataTableProps = Record<string, unknown> & {
  tableType: string;
  tableId: string;
  instanceId?: string;
  config: TableConfig;
  getTableActions: (tableType: string) => TableActions | undefined;
  initialViews: TableView[];
};

/** A table the dashboard can show: its config, actions and saved views. */
export interface DashboardTableSource {
  config: TableConfig;
  actions: TableActions;
  views?: TableView[];
  /** Name in pickers and titles; the config's title by default. */
  name?: string;
  /**
   * Host code for full-page `table` widgets, never stored in the document:
   * row, toolbar and bulk actions, `getFormConfig`, `details`, file tree
   * hooks… given to its `YayawDataTable` (camelCase props). The dashboard
   * keeps its own table id, config, actions (filtered, refreshing the screen
   * after changes) and starting views.
   */
  tableProps?: Record<string, unknown>;
  /**
   * Wraps or replaces the table of full-page `table` widgets: receives the
   * props the dashboard would give `YayawDataTable`; pass them on.
   */
  renderTable?: (props: DashboardDataTableProps) => VNodeChild;
}

export type DashboardLabel = (
  key: DashboardLabelKey,
  params?: Record<string, number | string>
) => string;

/** What a host block's component receives as props. */
export interface DashboardBlockProps<
  P extends DashboardJsonObject = DashboardJsonObject,
> {
  /** The widget's id in the document. */
  widgetId: string;
  /** The widget's props (JSON), over the block's `defaultProps`. */
  props: P;
  /** Its size in a grid section (columns, rows of 120px); none in a flow. */
  size?: { w: number; h: number };
  /** Whether the dashboard is in edit mode. */
  editing: boolean;
  /** The dashboard's language. */
  locale: string;
  /** Changes with "Refresh all" and after changes to the screen's data: load again. */
  revision: number;
  /**
   * The screen's filter values by filter id: date ranges with their days (a
   * relative preset's resolved, the preset kept), chosen options; nothing for
   * a filter that filters nothing.
   */
  filters: Readonly<Record<string, DashboardFilterValue | undefined>>;
  /** Reloads the widgets of a source (all of them without a source). */
  refresh: (tableId?: string) => void;
  /**
   * Sets a screen filter's value for the reader, exactly as the filter bar
   * does (the URL keeps it; in edit mode, the filter's default): a select
   * takes texts among its options, a date range `{ start?, end? }` days or a
   * `preset`; `undefined` clears it. A value the filter cannot take, or a
   * filter the screen does not have, is refused with the reason; nothing
   * changes then.
   */
  setFilter: (filterId: string, value: unknown) => DashboardSetFilterResult;
  /**
   * The rules the screen's filters give a source's requests (for a block
   * that queries it), without the filters in `exclude`: join them to its
   * `list`/`aggregate` requests as `requiredFilters`.
   */
  filterRules: (
    tableId: string,
    options?: { exclude?: readonly string[] }
  ) => Record<string, unknown>[];
  /** The host's `openView`, when it gives one. */
  openView?: (
    tableId: string,
    viewId: string | null,
    context?: DashboardOpenViewContext
  ) => void;
}

/** What a block's settings component receives (the screen editor shows it). */
export interface DashboardBlockSettingsProps<
  P extends DashboardJsonObject = DashboardJsonObject,
> {
  widgetId: string;
  props: P;
  onChange: (props: P) => void;
  locale: string;
}

/**
 * A host block: its schema (label, placement, default size and props, props
 * contract) and the Vue component that renders it (receiving
 * `DashboardBlockProps`). Blocks may render nothing: the widget then
 * collapses in a flow section and stays an empty card in a grid. A block that
 * throws shows its error in its widget only.
 */
export interface DashboardBlock extends DashboardBlockSchema {
  component: Component;
  /** Edits the block's props in the screen editor (`DashboardBlockSettingsProps`). */
  settings?: Component;
}

/** The host's blocks, by key (`home.summary`, `media.storage`…). */
export type DashboardBlockRegistry = Readonly<Record<string, DashboardBlock>>;

/** An entry the screen editor adds at the top of a widget's menu. */
export interface DashboardWidgetMenuAction {
  /** Stable id (`data-widget-action`). */
  id: string;
  label: string;
  icon?: Component;
  onSelect: () => void;
}

/** A section the widget's menu can move it to ("Move to section"). */
export interface DashboardWidgetMoveTarget {
  id: string;
  name: string;
}
