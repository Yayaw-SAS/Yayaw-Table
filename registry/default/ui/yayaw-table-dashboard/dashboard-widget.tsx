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
  useId,
  useMemo,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/ui/yayaw-table/components/data-table";
import type { TableConfig } from "@/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "@/components/ui/yayaw-table/providers/table-provider";
import type { DisplayModeRenderers } from "@/components/ui/yayaw-table/types/display-mode-renderer";
import type { TableDisplayMode } from "@/components/ui/yayaw-table/types/display-types";
import type { TableView } from "@/components/ui/yayaw-table/types/view-types";
import {
  canMoveLayoutItem,
  canResizeLayoutItem,
  type DashboardDirection,
  type DashboardLabelKey,
  type DashboardLayoutItem,
  type DashboardResize,
  type DashboardView,
  type DashboardWidget,
  widgetDisplayMode,
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
  return (
    <section
      aria-labelledby={titleId}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs"
      data-dashboard-widget={widget.id}
      data-widget-type={widget.type}
    >
      <header className="flex min-h-11 items-center gap-1 border-b px-2 py-1.5">
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
      <div className="min-h-0 flex-1 overflow-auto p-3" data-widget-body="">
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

const withMode = (config: TableConfig, mode: string): TableConfig => {
  const modes = config.table.displayModes ?? ["table"];
  return {
    ...config,
    table: {
      ...config.table,
      // Embedded: no URL, no toolbar, the widget's own view.
      syncUrl: false,
      showToolbar: false,
      showToolbarHeader: false,
      enableViews: false,
      displayModes: modes.includes(mode as TableDisplayMode)
        ? modes
        : [...modes, mode as TableDisplayMode],
    },
  };
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
}

/**
 * A table instance of its own (no URL, private state) showing the widget's
 * view; the dashboard filters join its `list`/`aggregate` requests.
 */
export function EmbeddedTableWidget({
  dashboardId,
  getRowId,
  label,
  locale,
  renderers,
  revision,
  rules,
  source,
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
  const config = useMemo(
    () => withMode(source.config, mode),
    [mode, source.config]
  );
  const rulesKey = JSON.stringify(rules);
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
                setFailure(undefined);
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
  }, [rulesKey, source.actions]);
  const retry = useCallback(() => {
    setFailure(undefined);
    setAttempt((value) => value + 1);
  }, []);
  const instanceId = `dashboard-${hash(
    `${dashboardId}:${widget.id}:${rulesKey}:${revision}:${attempt}`
  )}`;
  const initialView = useMemo(
    () => ({ id: view?.id ?? null, config: viewConfig }),
    [view?.id, viewConfig]
  );
  if (mode === "chart" && !renderers?.chart) {
    return (
      <WidgetMessage tone="error">
        {label("widgetError", { error: "chart renderer" })}
      </WidgetMessage>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-2" data-widget-mode={mode}>
      {failure && (
        <WidgetMessage onRetry={retry} retryLabel={label("retry")} tone="error">
          {label("widgetError", { error: failure })}
        </WidgetMessage>
      )}
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
      />
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
