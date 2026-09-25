"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DataTable } from "@/components/ui/yayaw-table/components/data-table";
import type { TableConfig } from "@/components/ui/yayaw-table/config/helpers";
import { invalidateTableDataQuery } from "@/components/ui/yayaw-table/hooks/query-cache-utils";
import type { TableActions } from "@/components/ui/yayaw-table/providers/table-provider";
import type { DisplayModeRenderers } from "@/components/ui/yayaw-table/types/display-mode-renderer";
import type { DataTableTranslations } from "@/components/ui/yayaw-table/types/translations";
import type { TableView } from "@/components/ui/yayaw-table/types/view-types";
import {
  type DashboardNotice,
  type DashboardWidget,
  dashboardScreenView,
  dashboardTableViews,
  withDashboardFilters,
  withDashboardTableViews,
  withMutationSignal,
  withNoticeCapture,
} from "./dashboard-model";
import {
  type DashboardDataTableProps,
  type DashboardTableSource,
  WidgetNotice,
} from "./dashboard-widget";

// Layout effects run before paint in the browser; the server skips them.
const useBrowserLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface DashboardPageTableProps {
  dashboardId: string;
  widget: DashboardWidget;
  /** The source id: the table's id, so URL keys, saved views and favorites stay the list page's. */
  sourceId: string;
  source: DashboardTableSource;
  /** None for the screen's first table (canonical URL keys), else the widget's id. */
  instanceId?: string;
  /** Name of the screen's default view (the widget's inline view). */
  screenViewName: string;
  /** The screen filters' rules for this widget (`requiredFilters`). */
  rules: Record<string, unknown>[];
  /** Changes with "Refresh all" and a refresh of this source: rows load again. */
  revision: number;
  /** After each change of the table's records: the screen reloads its other widgets. */
  onMutated: () => void;
  /** The screen's URL sync: off keeps the table's state out of the URL too. */
  syncUrl: boolean;
  renderers?: DisplayModeRenderers;
  locale: string;
  translations?: DataTableTranslations;
  getRowId?: (row: Record<string, unknown>) => string;
  noticeText: (notice: DashboardNotice) => string;
}

/** The source's config as a page table on a screen: the screen names it, not the table's header. */
const pageConfig = (config: TableConfig, syncUrl: boolean): TableConfig => ({
  ...config,
  table: {
    ...config.table,
    showToolbarHeader: false,
    ...(syncUrl ? {} : { syncUrl: false }),
  },
});

/**
 * A `table` widget: the source's full list page (toolbar, saved views,
 * selection, URL state) without a card. Its inline view is the screen's
 * default view; the screen's filters reach every request as
 * `requiredFilters`; its changes reload the screen's other widgets.
 */
export function DashboardPageTable({
  dashboardId,
  getRowId,
  instanceId,
  locale,
  noticeText,
  onMutated,
  renderers,
  revision,
  rules,
  screenViewName,
  source,
  sourceId,
  syncUrl,
  translations,
  widget,
}: DashboardPageTableProps) {
  const queryClient = useQueryClient();
  const rulesKey = JSON.stringify(rules);
  const mutated = useRef(onMutated);
  mutated.current = onMutated;
  const [notice, setNotice] = useState<DashboardNotice>();
  const screenView = useMemo(
    () => dashboardScreenView(dashboardId, widget, screenViewName),
    [dashboardId, screenViewName, widget]
  );
  const defaultViewId = screenView?.id ?? widget.viewId;
  const actions = useMemo(
    () =>
      withDashboardTableViews(
        withNoticeCapture(
          withMutationSignal(
            withDashboardFilters(
              source.actions,
              JSON.parse(rulesKey) as Record<string, unknown>[]
            ),
            () => mutated.current()
          ),
          setNotice
        ),
        defaultViewId
      ) as TableActions,
    [defaultViewId, rulesKey, source.actions]
  );
  const config = useMemo(
    () => pageConfig(source.config, syncUrl),
    [source.config, syncUrl]
  );
  const hostProps = source.tableProps ?? {};
  const initialViews = useMemo(
    () =>
      dashboardTableViews(
        [...(source.views ?? []), ...(hostProps.initialViews ?? [])],
        {
          screenView: screenView as unknown as TableView | undefined,
          defaultViewId: widget.viewId,
        }
      ),
    [hostProps.initialViews, screenView, source.views, widget.viewId]
  );

  // "Refresh all": the rows load again (a remount would show cached rows).
  const refreshed = useRef(revision);
  useEffect(() => {
    if (refreshed.current === revision) {
      return;
    }
    refreshed.current = revision;
    invalidateTableDataQuery({ queryClient, tableId: sourceId }).catch(
      () => undefined
    );
  }, [queryClient, revision, sourceId]);
  // New screen filters: the table remounts (its key) without the rows cached
  // under the previous filters.
  const filtered = useRef(rulesKey);
  useBrowserLayoutEffect(() => {
    if (filtered.current === rulesKey) {
      return;
    }
    filtered.current = rulesKey;
    queryClient
      .resetQueries({ queryKey: ["tableData", sourceId] })
      .catch(() => undefined);
  }, [queryClient, rulesKey, sourceId]);

  const hostRenderers = hostProps.displayModeRenderers;
  const displayModeRenderers = useMemo(
    () => ({ ...renderers, ...hostRenderers }),
    [hostRenderers, renderers]
  );
  const getTableActions = useCallback(() => actions, [actions]);
  const getTableConfig = useCallback(() => config, [config]);
  const props: DashboardDataTableProps = {
    ...hostProps,
    displayModeRenderers,
    getRowId: hostProps.getRowId ?? getRowId,
    locale: hostProps.locale ?? locale,
    translations: hostProps.translations ?? translations,
    tableType: sourceId,
    tableId: sourceId,
    instanceId,
    getTableActions,
    getTableConfig,
    initialViews,
  };
  const table: ReactNode = source.renderTable ? (
    source.renderTable(props)
  ) : (
    <DataTable {...props} />
  );
  return (
    <div className="flex min-w-0 flex-col gap-2" data-page-table={sourceId}>
      {notice ? (
        <WidgetNotice kind="notice" reason={notice.code}>
          {noticeText(notice)}
        </WidgetNotice>
      ) : null}
      {/* Kept mounted behind a notice, so "Refresh all" asks again. */}
      <div className={notice ? "hidden" : "contents"} key={rulesKey}>
        {table}
      </div>
    </div>
  );
}
