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
  canMoveLayoutItem,
  canResizeLayoutItem,
  type DashboardDirection,
  type DashboardLabelKey,
  type DashboardLayoutItem,
  type DashboardOverflow,
  type DashboardResize,
  type DashboardView,
  type DashboardWidget,
  dashboardFitPageSize,
  dashboardFitsRecords,
  dashboardListTotal,
  dashboardMoreCount,
  widgetDisplayMode,
  widgetOverflow,
  widgetViewConfig,
  withDashboardFilters,
} from "./dashboard-model";

/** A table the dashboard can show: its config, actions and saved views. */
export interface DashboardTableSource {
  config: TableConfig;
  actions: TableActions;
  views?: TableView[];
  /** Name in pickers and titles; the config's title by default. */
  name?: string;
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
  label,
  layout,
  onMove,
  onRemove,
  onResize,
  title,
  widgetId,
}: {
  label: DashboardLabel;
  layout: DashboardLayoutItem[];
  onMove: (direction: DashboardDirection) => void;
  onRemove: () => void;
  onResize: (change: DashboardResize) => void;
  title: string;
  widgetId: string;
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
              disabled={!canMoveLayoutItem(layout, widgetId, direction)}
              key={direction}
              onClick={() => onMove(direction)}
            >
              <Icon aria-hidden="true" />
              {label(key)}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        {RESIZES.map(({ change, key }) => {
          const Icon = RESIZE_ICONS[change];
          return (
            <DropdownMenuItem
              disabled={!canResizeLayoutItem(layout, widgetId, change)}
              key={change}
              onClick={() => onResize(change)}
            >
              <Icon aria-hidden="true" />
              {label(key)}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
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
  phone: boolean;
  layout: DashboardLayoutItem[];
  label: DashboardLabel;
  onMove: (direction: DashboardDirection) => void;
  onResize: (change: DashboardResize) => void;
  onRemove: () => void;
  onOpen?: () => void;
  children: ReactNode;
}

/** A widget's card: title, "Open full view", the edit menu and its content. */
export function DashboardWidgetFrame({
  children,
  editing,
  label,
  layout,
  onMove,
  onOpen,
  onRemove,
  onResize,
  phone,
  title,
  widget,
}: DashboardWidgetFrameProps) {
  const titleId = useId();
  const overflow: DashboardOverflow =
    widget.type === "view" ? widgetOverflow(widget) : "fit";
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
        {editing && !phone && (
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            data-dashboard-drag-handle=""
            title={label("dragHandle", { title })}
          >
            <GripVertical className="size-4" />
          </span>
        )}
        <h3
          className="min-w-0 flex-1 truncate px-1 font-medium text-sm"
          data-widget-title=""
          id={titleId}
        >
          {title}
        </h3>
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
            label={label}
            layout={layout}
            onMove={onMove}
            onRemove={onRemove}
            onResize={onResize}
            title={title}
            widgetId={widget.id}
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
        : { chart: { ...(typeof chart === "object" ? chart : {}), fill: true } }),
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
}

/**
 * A table instance of its own (no URL, private state) showing the widget's
 * view; the dashboard filters join its `list`/`aggregate` requests. A fit
 * widget (the default) shows the records that fit and "+N more".
 */
export function EmbeddedTableWidget({
  dashboardId,
  getRowId,
  label,
  locale,
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
  const fits = records && widgetOverflow(widget) === "fit";
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
  const actions = useMemo(() => {
    const filtered = withDashboardFilters(
      source.actions,
      JSON.parse(rulesKey) as Record<string, unknown>[]
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
  const initialView = useMemo(
    () => ({
      id: view?.id ?? null,
      config: pageSize ? { ...viewConfig, pageSize } : viewConfig,
    }),
    [pageSize, view?.id, viewConfig]
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
  const more =
    fits && total !== undefined && fit.shown !== undefined
      ? dashboardMoreCount(total, fit.shown)
      : 0;
  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-widget-mode={mode}
      data-widget-overflow={fits ? "fit" : undefined}
    >
      {failure && (
        <WidgetMessage
          onRetry={retry}
          retryLabel={label("retry")}
          tone="error"
        >
          {label("widgetError", { error: failure })}
        </WidgetMessage>
      )}
      {fits ? (
        <div data-dashboard-fit="" ref={fit.container}>
          {table}
        </div>
      ) : (
        table
      )}
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
