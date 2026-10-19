import type { ReactNode } from "react";
import type { AvatarOption } from "../utils/initials-avatar";
import type { KanbanLanes } from "../utils/kanban-lanes";
import type {
  TableGalleryMediaConfig,
  TableGalleryPreviewSize,
} from "../utils/media-contract";

export type {
  AvatarConfig,
  AvatarOption,
  AvatarShape,
} from "../utils/initials-avatar";
export type { KanbanLaneSettings, KanbanLanes } from "../utils/kanban-lanes";

/**
 * Display mode types shared by table configuration and saved views.
 */

export type { TableDensity } from "../utils/table-contracts";

export type { TableDisplayMode } from "../utils/display-modes";

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
  /** Optional remote board with independent lane pagination. Moves use the table update action. */
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

  /**
   * With allowDragUpdate, start a mouse or touch drag from anywhere on a card
   * instead of only its grip handle. A short click or tap still opens the
   * record; keyboard dragging stays on the handle. Defaults to false.
   */
  dragFromCard?: boolean;

  /**
   * Default lane order and hidden lanes, by grouping column id
   * (`{ "stage": { "order": ["won", "lead"], "hidden": ["lost"] } }`).
   * A saved view's `kanban.lanes` replaces a column's settings.
   */
  lanes?: KanbanLanes;

  /**
   * Avatar before each card title: the image of `imageColumn`, or initials
   * with a stable color when the record has none. Omitted shows none.
   */
  avatar?: AvatarOption;
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

  /**
   * Lane order and hidden lanes, by grouping column id. Switching views
   * switches lanes; the board's settings edit them.
   */
  lanes?: KanbanLanes;

  /** Avatar before each card title (see TableKanbanConfig.avatar). */
  avatar?: AvatarOption;
}

/** Rows as single lines: a title followed by compact properties. */
export type TableListViewConfig = import("../utils/list-view").ListViewSettings;

export type TableListConfig = TableListViewConfig;

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

  /**
   * Cards without an image show initials with a stable color instead of the
   * image placeholder. `nameColumn` defaults to the card title.
   */
  avatar?: AvatarOption;
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

  /** Initials for cards without an image (see TableGalleryConfig.avatar). */
  avatar?: AvatarOption;
}
