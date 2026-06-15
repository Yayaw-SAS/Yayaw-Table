/**
 * Display mode types shared by table configuration and saved views.
 */

export type TableDisplayMode = "kanban" | "table";

export interface TableKanbanGroupConfig {
  /**
   * Stored value used by the grouped column.
   */
  value: string;

  /**
   * Optional user-facing label. Defaults to the stored value.
   */
  label?: string;
}

export interface TableKanbanConfig {
  /**
   * Column used to split records into Kanban lanes.
   */
  groupBy?: string;

  /**
   * Column used as the card title.
   */
  titleColumn?: string;

  /**
   * Columns shown as compact card properties.
   */
  cardColumnIds?: string[];

  /**
   * Show property labels on each card. Hidden by default for a lighter Kanban scan.
   */
  showCardLabels?: boolean;

  /**
   * Optional fixed lane order. Missing row values are appended after these groups.
   */
  groups?: TableKanbanGroupConfig[];

  /**
   * Allow drag-and-drop updates between lanes when actions.update is available.
   */
  allowDragUpdate?: boolean;
}

export interface TableKanbanViewConfig {
  /**
   * Grouping column saved with a view.
   */
  groupBy?: string;
}
