"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ExternalLink,
  GripVertical,
  MoreHorizontal,
  MoveDiagonal2,
  MoveHorizontal,
  MoveVertical,
  Shrink,
  Trash2,
} from "lucide-react";
import {
  Component,
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { DataTable } from "@/src/components/ui/yayaw-table/components/data-table";
import type { TableConfig } from "@/src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "@/src/components/ui/yayaw-table/providers/table-provider";
import type { TableDisplayMode } from "@/src/components/ui/yayaw-table/types/display-types";
import type { DisplayModeRenderers } from "@/src/components/ui/yayaw-table/types/display-mode-renderer";
import type { DataTableTranslations } from "@/src/components/ui/yayaw-table/types/translations";
import type { TableView } from "@/src/components/ui/yayaw-table/types/view-types";
import { observeDashboardFit } from "./dashboard-fit";
import {
  type DashboardDirection,
  type DashboardLabelKey,
  type DashboardNotice,
  type DashboardOverflow,
  type DashboardResize,
  type DashboardView,
  type DashboardWidget,
  dashboardFitPageSize,
  dashboardFitsRecords,
  dashboardListTotal,
  dashboardMoreCount,
  dashboardWidgetViewId,
  widgetDisplayMode,
  widgetOverflow,
  widgetViewConfig,
  withDashboardFilters,
  withNoticeCapture,
} from "./dashboard-model";

/** The props of the `DataTable` a full-page `table` widget renders. */
export type DashboardDataTableProps = ComponentProps<typeof DataTable>;

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
   * hooks… given to its `DataTable`. The dashboard keeps its own table id,
   * config, actions (filtered, refreshing the screen after changes) and
   * starting views.
   */
  tableProps?: Partial<DashboardDataTableProps>;
  /**
   * Wraps or replaces the table of full-page `table` widgets: receives the
   * props the dashboard would give `DataTable`; pass them on.
   */
  renderTable?: (props: DashboardDataTableProps) => ReactNode;
}

export type DashboardLabel = (
  key: DashboardLabelKey,
  params?: Record<string, number | string>
) => string;

const MOVES: { direction: DashboardDirection; key: DashboardLabelKey }[] = [
  { direction: "left", key: "moveLeft" },
  { direction: "right", key: "moveRight" },
  { direction: "up", key: "moveUp" },
  { direction: "down", key: "moveDown" },
];
const MOVE_ICONS = {
  left: ArrowLeft,
  right: ArrowRight,
  up: ArrowUp,
  down: ArrowDown,
};
const RESIZES: { change: DashboardResize; key: DashboardLabelKey }[] = [
  { change: "wider", key: "wider" },
  { change: "narrower", key: "narrower" },
  { change: "taller", key: "taller" },
  { change: "shorter", key: "shorter" },
];
const RESIZE_ICONS = {
  wider: MoveHorizontal,
  narrower: Shrink,
  taller: MoveVertical,
  shorter: MoveDiagonal2,
};

/** Edit menu: keyboard alternatives to dragging and resizing, and removal. */
function WidgetMenu({
  canMove,
  canResize,
  label,
  onMove,
  onRemove,
  onResize,
  resizable,
  title,
}: {
  canMove: (direction: DashboardDirection) => boolean;
  canResize: (change: DashboardResize) => boolean;
  label: DashboardLabel;
  onMove: (direction: DashboardDirection) => void;
  onRemove: () => void;
  onResize: (change: DashboardResize) => void;
  /** Grid widgets resize; flow widgets keep their natural size. */
  resizable: boolean;
  title: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={label("widgetMenu", { title })}
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {MOVES.map(({ direction, key }) => {
          const Icon = MOVE_ICONS[direction];
          return (
            <DropdownMenuItem
              disabled={!canMove(direction)}
              key={direction}
              onClick={() => onMove(direction)}
            >
              <Icon aria-hidden="true" />
              {label(key)}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        {resizable ? (
          <>
            {RESIZES.map(({ change, key }) => {
              const Icon = RESIZE_ICONS[change];
              return (
                <DropdownMenuItem
                  disabled={!canResize(change)}
                  key={change}
                  onClick={() => onResize(change)}
                >
                  <Icon aria-hidden="true" />
                  {label(key)}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onClick={onRemove} variant="destructive">
          <Trash2 aria-hidden="true" />
          {label("remove")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface DashboardWidgetFrameProps {
  widget: DashboardWidget;
  title: string;
  editing: boolean;
  /** Desktop grid widgets show a drag handle in edit mode. */
  draggable: boolean;
  /** Grid widgets resize from the menu; flow widgets keep their natural size. */
  resizable: boolean;
  /** 4 under a section title, else 3 (under the dashboard's name). */
  headingLevel?: 3 | 4;
  /**
   * `card` (default): a card with its title. `page`: no card, for full-page
   * tables; an edit bar in edit mode, and a heading only with `showHeading`.
   */
  frame?: "card" | "page";
  /** Page frames: show the title as a heading (the widget has a title of its own). */
  showHeading?: boolean;
  label: DashboardLabel;
  canMove: (direction: DashboardDirection) => boolean;
  canResize: (change: DashboardResize) => boolean;
  onMove: (direction: DashboardDirection) => void;
  onResize: (change: DashboardResize) => void;
  onRemove: () => void;
  onOpen?: () => void;
  children: ReactNode;
}

/**
 * A full-page table's frame: no card. In edit mode, a bar with its title and
 * menu; a heading when the widget has a title of its own.
 */
function PageFrame({
  canMove,
  canResize,
  children,
  editing,
  headingLevel = 3,
  label,
  onMove,
  onRemove,
  onResize,
  showHeading = false,
  title,
  widget,
}: DashboardWidgetFrameProps) {
  const titleId = useId();
  const Heading = headingLevel === 4 ? "h4" : "h3";
  return (
    <section
      aria-label={showHeading ? undefined : title}
      aria-labelledby={showHeading ? titleId : undefined}
      className="flex min-w-0 flex-col gap-2"
      data-dashboard-widget={widget.id}
      data-widget-frame="page"
      data-widget-type={widget.type}
    >
      {editing && (
        <header
          className="flex min-h-10 items-center gap-2 rounded-lg border border-dashed px-3 py-1 text-sm"
          data-widget-edit-bar=""
        >
          <span className="min-w-0 truncate font-medium" data-widget-title="">
            {title}
          </span>
          <span className="shrink-0 text-muted-foreground text-xs">
            {label(widget.type === "table" ? "typeTable" : "typeBlock")}
          </span>
          <span className="ms-auto">
            <WidgetMenu
              canMove={canMove}
              canResize={canResize}
              label={label}
              onMove={onMove}
              onRemove={onRemove}
              onResize={onResize}
              resizable={false}
              title={title}
            />
          </span>
        </header>
      )}
      {showHeading && (
        <Heading
          className="font-semibold text-base"
          data-widget-heading=""
          id={titleId}
        >
          {title}
        </Heading>
      )}
      <div className="flex min-w-0 flex-col" data-widget-body="">
        {children}
      </div>
    </section>
  );
}

/** A widget's card: title, "Open full view", the edit menu and its content. */
export function DashboardWidgetFrame(props: DashboardWidgetFrameProps) {
  if (props.frame === "page") {
    return <PageFrame {...props} />;
  }
  return <CardFrame {...props} />;
}

function CardFrame({
  canMove,
  canResize,
  children,
  draggable,
  editing,
  headingLevel = 3,
  label,
  onMove,
  onOpen,
  onRemove,
  onResize,
  resizable,
  title,
  widget,
}: DashboardWidgetFrameProps) {
  const titleId = useId();
  const overflow: DashboardOverflow =
    widget.type === "view" ? widgetOverflow(widget) : "fit";
  const Heading = headingLevel === 4 ? "h4" : "h3";
  return (
    <section
      aria-labelledby={titleId}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs"
      data-dashboard-widget={widget.id}
      data-widget-type={widget.type}
    >
      <header
        className="flex min-h-10 items-center gap-1 border-b px-2 py-1"
        data-widget-header=""
      >
        {editing && draggable && (
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            data-dashboard-drag-handle=""
            title={label("dragHandle", { title })}
          >
            <GripVertical className="size-4" />
          </span>
        )}
        <Heading
          className="min-w-0 flex-1 truncate px-1 font-medium text-sm"
          data-widget-title=""
          id={titleId}
        >
          {title}
        </Heading>
        {onOpen && (
          <Button
            aria-label={label("openFullView")}
            onClick={onOpen}
            size="icon-sm"
            title={label("openFullView")}
            type="button"
            variant="ghost"
          >
            <ExternalLink aria-hidden="true" />
          </Button>
        )}
        {editing && (
          <WidgetMenu
            canMove={canMove}
            canResize={canResize}
            label={label}
            onMove={onMove}
            onRemove={onRemove}
            onResize={onResize}
            resizable={resizable}
            title={title}
          />
        )}
      </header>
      <div
        className="flex min-h-0 flex-1 flex-col p-3"
        data-overflow={overflow}
        data-widget-body=""
      >
        {children}
      </div>
    </section>
  );
}

interface BoundaryProps {
  children: ReactNode;
  fallback: (error: Error, retry: () => void) => ReactNode;
}

/** A widget that fails to render shows its error; the others keep working. */
export class WidgetErrorBoundary extends Component<
  BoundaryProps,
  { error?: Error }
> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  render() {
    const { error } = this.state;
    return error
      ? this.props.fallback(error, () => this.setState({ error: undefined }))
      : this.props.children;
  }
}

/** Loading, error and missing states inside a widget. */
export function WidgetMessage({
  children,
  onRetry,
  retryLabel,
  tone = "muted",
}: {
  children: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  tone?: "muted" | "error";
}) {
  return (
    <div
      className="flex h-full min-h-16 flex-col items-center justify-center gap-2 text-center text-sm"
      data-widget-state={tone}
    >
      {tone === "error" ? (
        <p className="text-destructive" role="alert">
          {children}
        </p>
      ) : (
        <output className="text-muted-foreground">{children}</output>
      )}
      {onRetry && (
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

/**
 * A muted notice in place of a widget's content: an unavailable source
 * (`unavailable`, with its reason), a block the host lacks (`unknownBlock`),
 * or a source's `meta.notice` (`notice`, with its code).
 */
export function WidgetNotice({
  children,
  kind,
  reason,
}: {
  children: ReactNode;
  kind: "unavailable" | "unknownBlock" | "notice";
  reason?: string;
}) {
  return (
    <div
      className="flex h-full min-h-16 flex-col items-center justify-center gap-2 px-2 text-center text-muted-foreground text-sm"
      data-widget-reason={reason}
      data-widget-state={kind}
    >
      <p className="m-0">{children}</p>
    </div>
  );
}

/**
 * The table as a widget embeds it: no URL, toolbar, views or row selection;
 * charts fill the widget. Only records that scroll (`overflow: "scroll"`)
 * keep their pagination; fit records show "+N more" instead.
 */
const withMode = (
  config: TableConfig,
  mode: string,
  paginated: boolean
): TableConfig => {
  const modes = config.table.displayModes ?? ["table"];
  const chart = config.table.chart;
  return {
    ...config,
    table: {
      ...config.table,
      syncUrl: false,
      showToolbar: false,
      showToolbarHeader: false,
      enableViews: false,
      enableRowSelection: false,
      ...(paginated ? {} : { enablePagination: false }),
      ...(chart === false
        ? {}
        : {
            chart: { ...(typeof chart === "object" ? chart : {}), fill: true },
          }),
      displayModes: modes.includes(mode as TableDisplayMode)
        ? modes
        : [...modes, mode as TableDisplayMode],
    },
  };
};

/** "+3 more · View all" under a fit widget's records. */
export function WidgetMore({
  count,
  label,
  onViewAll,
}: {
  count: number;
  label: DashboardLabel;
  onViewAll?: () => void;
}) {
  return (
    <footer data-widget-more="">
      <span>{label("moreCount", { count })}</span>
      {onViewAll ? (
        <>
          <span aria-hidden="true">·</span>
          <button onClick={onViewAll} type="button">
            {label("viewAll")}
          </button>
        </>
      ) : null}
    </footer>
  );
}

/** Records shown by a fit widget, as its container fits them. */
function useFitRecords(enabled: boolean, key: string) {
  const container = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<number>();
  useEffect(() => {
    const element = container.current;
    setShown(undefined);
    if (!(enabled && element && key)) {
      return;
    }
    return observeDashboardFit(element, (result) => setShown(result.shown));
  }, [enabled, key]);
  return { container, shown };
}

/**
 * Totals `list` reported per instance: an instance mounted again (a phone
 * rotated to a desktop width) reads its rows from the query cache, not `list`.
 * The most recent ones are kept.
 */
const listTotals = new Map<string, number>();
const MAX_LIST_TOTALS = 200;
const rememberTotal = (instanceId: string, total: number) => {
  listTotals.delete(instanceId);
  listTotals.set(instanceId, total);
  const oldest = listTotals.keys().next().value;
  if (listTotals.size > MAX_LIST_TOTALS && oldest !== undefined) {
    listTotals.delete(oldest);
  }
};

/** Short, stable instance keys (widget, filters and refresh count). */
const hash = (value: string): string => {
  let result = 5381;
  for (const character of value) {
    result = (result * 33 + (character.codePointAt(0) ?? 0)) % 2_147_483_647;
  }
  return result.toString(36);
};

export interface EmbeddedTableWidgetProps {
  dashboardId: string;
  widget: DashboardWidget;
  source: DashboardTableSource;
  view?: DashboardView;
  rules: Record<string, unknown>[];
  revision: number;
  renderers?: DisplayModeRenderers;
  locale: string;
  label: DashboardLabel;
  getRowId?: (row: Record<string, unknown>) => string;
  /** The widget's size in the layout, which sets how many records a fit widget loads. */
  size: { w: number; h: number };
  /** "View all" under the records of a fit widget: the full view. */
  onViewAll?: () => void;
  /** The page's table labels, e.g. French pagination. */
  translations?: DataTableTranslations;
  /**
   * A flow section's widget: its natural height, so records keep the
   * view's pagination instead of fitting a height.
   */
  natural?: boolean;
  /** What a source's `meta.notice` says (`dashboardNoticeText`). */
  noticeText: (notice: DashboardNotice) => string;
}

/**
 * A table instance of its own (no URL, private state) showing the widget's
 * view (inline settings or a saved view); the dashboard filters join its
 * `list`/`aggregate` requests. A fit widget (the default in grids) shows the
 * records that fit and "+N more". A `meta.notice` in an answer shows instead
 * of the records.
 */
export function EmbeddedTableWidget({
  dashboardId,
  getRowId,
  label,
  locale,
  natural = false,
  noticeText,
  onViewAll,
  renderers,
  revision,
  rules,
  size,
  source,
  translations,
  view,
  widget,
}: EmbeddedTableWidgetProps) {
  const [failure, setFailure] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const viewConfig = useMemo(
    () => widgetViewConfig(widget, view),
    [view, widget]
  );
  const mode = widgetDisplayMode(viewConfig);
  const records = dashboardFitsRecords(mode);
  const fits = records && !natural && widgetOverflow(widget) === "fit";
  const pageSize = fits
    ? dashboardFitPageSize(mode, size, viewConfig.pageSize)
    : undefined;
  const paginated = records && !fits;
  const config = useMemo(
    () => withMode(source.config, mode, paginated),
    [mode, paginated, source.config]
  );
  const rulesKey = JSON.stringify(rules);
  const instanceId = `dashboard-${hash(
    `${dashboardId}:${widget.id}:${rulesKey}:${revision}:${attempt}:${pageSize ?? ""}`
  )}`;
  // Re-renders when `list` answers; the total is read for the current instance.
  const [, setListed] = useState(0);
  const total = listTotals.get(instanceId);
  const [notice, setNotice] = useState<{
    instanceId: string;
    notice?: DashboardNotice;
  }>();
  const actions = useMemo(() => {
    const filtered = withNoticeCapture(
      withDashboardFilters(
        source.actions,
        JSON.parse(rulesKey) as Record<string, unknown>[]
      ),
      (found) => setNotice({ instanceId, notice: found })
    );
    const { list } = filtered;
    return {
      ...filtered,
      ...(list
        ? {
            list: async (params: Record<string, unknown>) => {
              try {
                const result = await list(params);
                const count = dashboardListTotal(result);
                if (count !== undefined) {
                  rememberTotal(instanceId, count);
                }
                setFailure(undefined);
                setListed((value) => value + 1);
                return result;
              } catch (error) {
                setFailure(
                  error instanceof Error ? error.message : String(error)
                );
                throw error;
              }
            },
          }
        : {}),
    } as TableActions;
  }, [instanceId, rulesKey, source.actions]);
  const retry = useCallback(() => {
    setFailure(undefined);
    setAttempt((value) => value + 1);
  }, []);
  const viewId = dashboardWidgetViewId(widget);
  const initialView = useMemo(
    () => ({
      id: viewId,
      config: pageSize ? { ...viewConfig, pageSize } : viewConfig,
    }),
    [pageSize, viewId, viewConfig]
  );
  const fit = useFitRecords(fits, instanceId);
  if (mode === "chart" && !renderers?.chart) {
    return (
      <WidgetMessage tone="error">
        {label("widgetError", { error: "chart renderer" })}
      </WidgetMessage>
    );
  }
  const table = (
    <DataTable
      displayModeRenderers={renderers}
      enableToolbar={false}
      getRowId={getRowId}
      getTableActions={() => actions}
      getTableConfig={() => config}
      initialView={initialView}
      instanceId={instanceId}
      key={instanceId}
      locale={locale}
      showFilterBar={false}
      tableId={instanceId}
      tableType={widget.tableId ?? source.config.id}
      translations={translations}
    />
  );
  const shownNotice =
    notice?.instanceId === instanceId ? notice.notice : undefined;
  const more =
    fits && total !== undefined && fit.shown !== undefined && !shownNotice
      ? dashboardMoreCount(total, fit.shown)
      : 0;
  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-widget-mode={mode}
      data-widget-overflow={fits ? "fit" : undefined}
    >
      {failure && (
        <WidgetMessage onRetry={retry} retryLabel={label("retry")} tone="error">
          {label("widgetError", { error: failure })}
        </WidgetMessage>
      )}
      {shownNotice ? (
        <WidgetNotice kind="notice" reason={shownNotice.code}>
          {noticeText(shownNotice)}
        </WidgetNotice>
      ) : null}
      {/* Kept mounted behind a notice, so "Refresh all" asks again. */}
      <div className={shownNotice ? "hidden" : "contents"}>
        {fits ? (
          <div data-dashboard-fit="" ref={fit.container}>
            {table}
          </div>
        ) : (
          table
        )}
      </div>
      {more > 0 ? (
        <WidgetMore count={more} label={label} onViewAll={onViewAll} />
      ) : null}
    </div>
  );
}

/** A note: the host's markdown renderer, or plain text. */
export function NoteWidget({
  emptyLabel,
  renderMarkdown,
  text,
}: {
  emptyLabel: string;
  renderMarkdown?: (text: string) => ReactNode;
  text: string;
}) {
  if (!text.trim()) {
    return <WidgetMessage>{emptyLabel}</WidgetMessage>;
  }
  return (
    <div className="text-sm" data-widget-note="">
      {renderMarkdown ? (
        renderMarkdown(text)
      ) : (
        <p className="whitespace-pre-wrap">{text}</p>
      )}
    </div>
  );
}
