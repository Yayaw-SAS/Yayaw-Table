import type { ReactNode } from "react";
import type {
  TableGalleryMediaConfig,
  TableGalleryPreviewSize,
} from "../utils/media-contract";

/**
 * Display mode types shared by table configuration and saved views.
 */

export type { TableDensity } from "../utils/table-contracts";

export type TableDisplayMode = "gallery" | "kanban" | "table" | "gantt";

export type TableGalleryAspectRatio = "portrait" | "square" | "video" | "wide";

export type TableGalleryCardSize = "large" | "medium" | "small";

export type TableGalleryImageFit = "contain" | "cover";

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
  /** Optional read-oriented remote board. Grid pagination and drag mutations do not apply. */
  server?: import("../utils/server-kanban").ServerKanbanSource;
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
   * Legacy grouping column saved with older views.
   * New views use TableViewConfig.grouping so table, Kanban, and gallery share
   * the same grouping state.
   *
   * @deprecated Use TableViewConfig.grouping.
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
   * Show property labels on each card.
   */
  showCardLabels?: boolean;
}

/** Runtime renderers are deliberately excluded from saved view configuration. */
export interface TableGalleryRenderContext {
  row: Record<string, unknown>;
  title: string;
  source?: string;
  imageFit: TableGalleryImageFit;
  aspectRatio: TableGalleryAspectRatio;
}

export interface TableGalleryConfig {
  media?: TableGalleryMediaConfig;
  previewSize?: TableGalleryPreviewSize;
  renderMedia?: (context: TableGalleryRenderContext) => ReactNode;
  renderProperties?: (context: TableGalleryRenderContext) => ReactNode;

  /**
   * Column used as the gallery media source.
   */
  imageColumn?: string;

  /**
   * Column used as the card title.
   */
  titleColumn?: string;

  /**
   * Columns shown as compact card properties.
   */
  cardColumnIds?: string[];

  /**
   * Media aspect ratio for gallery cards.
   */
  aspectRatio?: TableGalleryAspectRatio;

  /**
   * How images should fit inside their media area.
   */
  imageFit?: TableGalleryImageFit;

  /**
   * Responsive card width preset.
   */
  cardSize?: TableGalleryCardSize;

  /**
   * Show property labels on each card. Hidden by default for a lighter gallery scan.
   */
  showCardLabels?: boolean;
}

export interface TableGalleryViewConfig {
  previewSize?: TableGalleryPreviewSize;
  /**
   * Column used as the gallery media source.
   */
  imageColumn?: string;

  /**
   * Column used as the card title.
   */
  titleColumn?: string;

  /**
   * Columns shown as compact card properties.
   */
  cardColumnIds?: string[];

  /**
   * Media aspect ratio for gallery cards.
   */
  aspectRatio?: TableGalleryAspectRatio;

  /**
   * How images should fit inside their media area.
   */
  imageFit?: TableGalleryImageFit;

  /**
   * Responsive card width preset.
   */
  cardSize?: TableGalleryCardSize;

  /**
   * Show property labels on each card.
   */
  showCardLabels?: boolean;
}
