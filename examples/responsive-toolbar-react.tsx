"use client";

import { Archive } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";

import type { TableView } from "../src/components/ui/yayaw-table/types/view-types";

const openView: TableView = {
  id: "open",
  createdById: "demo",
  tableId: "responsive-toolbar",
  name: "Open items",
  config: { columnFilters: [{ id: "status", value: ["Open"] }] },
};
// Demo-only in-memory persistence. Production handlers must enforce user and organization scope.
const savedViews = new Map<string, TableView>([[openView.id, openView]]);
const rows = [
  { id: "1", name: "Atlas", status: "Open", price: 24, active: true },
  { id: "2", name: "Beacon", status: "Closed", price: 12, active: false },
  { id: "3", name: "Current", status: "Open", price: 36, active: true },
];
const actions: TableActions = {
  views: {
    list: async () => ({ data: [...savedViews.values()] }),
    create: (input) => {
      const view: TableView = {
        ...input,
        id: crypto.randomUUID(),
        createdById: "demo",
      };
      savedViews.set(view.id, view);
      return Promise.resolve({ success: true, data: view });
    },
    update: (id, input) => {
      const current = savedViews.get(id);
      if (!current) {
        return Promise.resolve({ success: false, error: "View not found" });
      }
      const view = { ...current, ...input };
      savedViews.set(id, view);
      return Promise.resolve({ success: true, data: view });
    },
    delete: (id) => {
      savedViews.delete(id);
      return Promise.resolve({ success: true, data: { id } });
    },
  },
  list: ({ filters, search }) => {
    const data = rows.filter((row) => {
      if (
        search &&
        !row.name.toLowerCase().includes(String(search).toLowerCase())
      ) {
        return false;
      }
      return Object.entries(filters ?? {}).every(([id, value]) => {
        const choices = Array.isArray(value) ? value : [value];
        return choices.includes(row[id as keyof typeof row]);
      });
    });
    return Promise.resolve({
      data,
      meta: { totalCount: data.length, pageCount: 1 },
    });
  },
  create: (values) => {
    const row = {
      id: crypto.randomUUID(),
      name: String(values.name ?? ""),
      status: String(values.status ?? "Open"),
      price: Number(values.price ?? 0),
      active: Boolean(values.active),
    };
    rows.push(row);
    return Promise.resolve({ success: true, data: row });
  },
};
const getActions = () => actions;

/** Mount inside NuqsAdapter. Archives is deliberately an application-owned action. */
export function ResponsiveToolbarExample() {
  const [icons, setIcons] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [views, setViews] = useState(true);
  const [activity, setActivity] = useState(
    "Try changing a saved view, then restoring it."
  );
  const config = useMemo(
    () =>
      defineTableConfig({
        id: "responsive-toolbar",
        columns: {
          definitions: [
            { id: "name", header: "Name", type: "text", enableGrouping: false },
            {
              id: "status",
              header: "Status",
              type: "select",
              options: ["Open", "Closed"].map((value) => ({
                value,
                label: value,
              })),
            },
            {
              id: "price",
              header: "Price",
              type: "number",
              defaultCalculation: "sum",
            },
            { id: "active", header: "Active", type: "boolean" },
          ],
          mandatory: ["name"],
          visible: ["name", "status", "price", "active"],
          order: ["name", "status", "price", "active"],
        },
        table: {
          actionsAsIcons: icons,
          enableViews: views,
          enableCalculations: true,
          displayModes: ["table", "kanban", "gallery"],
          density: "medium",
          showFilterBar: true,
          filterBarColumns: ["status", "active"],
          showClearFilters: true,
          enableAdvancedFilters: true,
          syncUrl: true,
          kanban: {
            groupBy: "status",
            titleColumn: "name",
            cardColumnIds: ["price", "active"],
          },
          gallery: { titleColumn: "name", cardColumnIds: ["price", "status"] },
          allowEdit: false,
          allowDelete: false,
          allowDuplicate: false,
        },
        translations: {
          namespace: "demo",
          keys: {
            title: "Responsive views",
            description:
              "One toolbar, with settings adapted to each presentation.",
          },
        },
      }),
    [icons, views]
  );
  const getConfig = useCallback(() => config, [config]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <label>
          <input
            checked={icons}
            onChange={(event) => setIcons(event.target.checked)}
            type="checkbox"
          />{" "}
          Icons on desktop
        </label>
        <label>
          <input
            checked={narrow}
            onChange={(event) => setNarrow(event.target.checked)}
            type="checkbox"
          />{" "}
          Narrow container
        </label>
        <label>
          <input
            checked={views}
            onChange={(event) => setViews(event.target.checked)}
            type="checkbox"
          />{" "}
          Saved views
        </label>
      </div>
      <output>{activity}</output>
      <div style={{ maxWidth: narrow ? 620 : undefined }}>
        <DataTable
          getTableActions={getActions}
          getTableConfig={getConfig}
          initialData={rows}
          initialViews={[openView]}
          tableType={config.id}
          toolbarActions={[
            {
              id: "archives",
              label: "Archives",
              icon: <Archive className="size-4" />,
              onClick: () =>
                setActivity(
                  "This optional Archives action is supplied by the application."
                ),
            },
          ]}
        />
      </div>
    </div>
  );
}
