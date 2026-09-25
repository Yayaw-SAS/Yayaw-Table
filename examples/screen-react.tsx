"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import type { TableView } from "../src/components/ui/yayaw-table/types/view-types";
import type {
  DashboardBlockProps,
  DashboardBlockRegistry,
} from "../src/components/ui/yayaw-table-dashboard/dashboard-block";
import type { DashboardInlineView } from "../src/components/ui/yayaw-table-dashboard/dashboard-schema";
import {
  type DashboardTableSource,
  YayawDashboard,
} from "../src/components/ui/yayaw-table-dashboard/yayaw-dashboard";
import { frenchTableTranslations } from "./dashboard-react";
import {
  attentionViews,
  createScreenHost,
  createScreenStorage,
  SCREEN_BLOCKS,
  type ScreenHost,
  type ScreenShortcut,
  type ScreenSourceSpec,
  screenAttention,
  screenText,
} from "./screen";

const ScreenHostContext = createContext<
  ScreenHost<DashboardTableSource> | undefined
>(undefined);

/** Links to frequent tasks; nothing without links. */
function ShortcutsBlock({ locale, props }: DashboardBlockProps) {
  const links = Array.isArray(props.links)
    ? (props.links as unknown as ScreenShortcut[])
    : [];
  if (!links.length) {
    return null;
  }
  return (
    <ul className="m-0 grid list-none gap-1.5 p-0 text-sm" data-shortcuts="">
      {links.map((link) => (
        <li key={link.href}>
          <a
            className="font-medium underline-offset-4 hover:underline"
            href={link.href}
          >
            {screenText(link.label, locale)}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * What needs attention under the screen's filters, read again with each
 * revision (after changes and "Refresh all"); nothing when all is done.
 */
function AttentionBlock({ filters, locale, openView }: DashboardBlockProps) {
  const host = useContext(ScreenHostContext);
  const items = host ? screenAttention(host, filters, locale) : [];
  if (!items.length) {
    return null;
  }
  return (
    <ul className="m-0 grid list-none gap-1.5 p-0 text-sm" data-attention="">
      {items.map((item) => (
        <li key={item.id}>
          <button
            className="text-left underline-offset-4 hover:underline"
            data-attention-item={item.id}
            onClick={() => {
              const target = attentionViews[item.id];
              openView?.(target.tableId, null, {
                view: target.view as DashboardInlineView,
              });
            }}
            type="button"
          >
            {item.text}
          </button>
        </li>
      ))}
    </ul>
  );
}

const blocks: DashboardBlockRegistry = {
  shortcuts: { ...SCREEN_BLOCKS.shortcuts, component: ShortcutsBlock },
  attention: { ...SCREEN_BLOCKS.attention, component: AttentionBlock },
};

/** Each catalogue source as a React table; the Pages list page is wrapped by the host. */
const buildSource =
  (locale: string) =>
  (spec: ScreenSourceSpec): DashboardTableSource => {
    const name = screenText(spec.name, locale);
    return {
      name,
      config: defineTableConfig({
        id: spec.id,
        columns: {
          definitions: spec.columns as never,
          order: spec.columns.map((column) => String(column.id)),
          visible: spec.visible,
          mandatory: spec.mandatory,
        },
        table: spec.table as never,
        translations: { namespace: spec.id, keys: { title: name } },
      }),
      actions: spec.actions as unknown as TableActions,
      views: spec.views as unknown as TableView[],
      ...(spec.id === "pages"
        ? {
            renderTable: (props) => (
              <div data-host-table="">
                <DataTable {...props} />
              </div>
            ),
          }
        : {}),
    };
  };

/**
 * "Content admin": a screen whose sources load on demand from the host's
 * catalogue, with host blocks and the Pages list page. `?readonly` shows it
 * without edit rights, `?hide` hides unavailable widgets, `?lang=fr` shows it
 * in French.
 */
export function ScreenExample() {
  const search = new URLSearchParams(window.location.search);
  const canEdit = !search.has("readonly");
  const french = search.get("lang") === "fr";
  const locale = french ? "fr" : "en";
  const host = useMemo(() => createScreenHost(buildSource(locale)), [locale]);
  const storage = useMemo(() => createScreenStorage(), []);
  const [opened, setOpened] = useState("");
  return (
    <ScreenHostContext.Provider value={host}>
      <main className="min-h-screen bg-background px-4 py-4 text-foreground sm:px-6">
        <div className="mx-auto max-w-7xl">
          <YayawDashboard
            actions={{ dashboards: storage }}
            blocks={blocks}
            canEdit={canEdit}
            dashboardId="content-admin"
            getRowId={(row) => String(row.id)}
            locale={locale}
            openView={(tableId, viewId, context) =>
              setOpened(
                `${tableId} › ${viewId ?? "default"}${context?.view ? " (inline)" : ""}`
              )
            }
            sources={host.sources}
            tableTranslations={french ? frenchTableTranslations : undefined}
            unavailableWidgets={search.has("hide") ? "hide" : "show"}
          />
          {opened ? (
            <output
              className="fixed bottom-4 left-4 rounded-md border bg-background px-3 py-2 text-muted-foreground text-sm shadow-sm"
              data-dashboard-opened=""
            >
              {opened}
            </output>
          ) : null}
        </div>
      </main>
    </ScreenHostContext.Provider>
  );
}
