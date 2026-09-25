"use client";

import type { ComponentType } from "react";
import type {
  DashboardFilterValue,
  DashboardOpenViewContext,
  DashboardSetFilterResult,
} from "./dashboard-model";
import type {
  DashboardBlockSchema,
  DashboardJsonObject,
} from "./dashboard-schema";

/** What a host block's component receives. */
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
 * contract) and the React component that renders it. Blocks may render
 * nothing: the widget then collapses in a flow section and stays an empty
 * card in a grid. A block that throws shows its error in its widget only.
 */
export interface DashboardBlock<
  P extends DashboardJsonObject = DashboardJsonObject,
> extends DashboardBlockSchema {
  component: ComponentType<DashboardBlockProps<P>>;
  /** Edits the block's props in the screen editor. */
  settings?: ComponentType<DashboardBlockSettingsProps<P>>;
}

/** The host's blocks, by key (`home.summary`, `media.storage`…). */
export type DashboardBlockRegistry = Readonly<Record<string, DashboardBlock>>;

/** Types a block's props for its component, as the registry holds it. */
export const defineDashboardBlock = <P extends DashboardJsonObject>(
  block: DashboardBlock<P>
): DashboardBlock => block as unknown as DashboardBlock;

/** A block's content; empty (`:empty`) when the block renders nothing. */
export function BlockContent({
  block,
  ...props
}: DashboardBlockProps & { block: DashboardBlock }) {
  const Component = block.component;
  return (
    <div className="min-w-0" data-block-content="">
      <Component {...props} />
    </div>
  );
}
