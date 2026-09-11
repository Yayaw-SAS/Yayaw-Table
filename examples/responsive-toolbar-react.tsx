"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Archive } from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";
import { Button } from "../src/components/ui/button";
import { Checkbox } from "../src/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../src/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../src/components/ui/select";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";

import type { TableView } from "../src/components/ui/yayaw-table/types/view-types";
import { queryToolbarRows } from "./responsive-toolbar-data";

const openView: TableView = {
  id: "open",
  createdById: "demo",
  tableId: "responsive-toolbar",
  name: "Open items",
  config: { columnFilters: [{ id: "status", value: ["Open"] }] },
};
// Demo-only in-memory persistence. Production handlers must enforce user and organization scope.
const savedViews = new Map<string, TableView>([[openView.id, openView]]);
let rows = [
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
  list: (params) => Promise.resolve(queryToolbarRows(rows, params)),
  update: (id, patch) => {
    const row = rows.find((item) => item.id === id);
    if (!row) {
      return Promise.resolve({ success: false, error: "Item not found" });
    }
    const updated = { ...row, ...patch, id };
    rows = rows.map((item) => (item.id === id ? updated : item));
    return Promise.resolve({ success: true, data: updated });
  },
  bulkUpdate: (ids, patch) => {
    rows = rows.map((row) =>
      ids.includes(row.id) ? { ...row, ...patch, id: row.id } : row
    );
    const targets = rows.filter((row) => ids.includes(row.id));
    return Promise.resolve({ success: true, data: targets });
  },
  bulkCopy: (ids) => {
    const copies = rows
      .filter((row) => ids.includes(row.id))
      .map((row) => ({
        ...row,
        id: crypto.randomUUID(),
        name: `${row.name} copy`,
      }));
    rows.push(...copies);
    return Promise.resolve({ success: true, data: copies });
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

/** Mount inside NuqsAdapter and QueryClientProvider. Archives is application-owned. */
export function ResponsiveToolbarExample() {
  const controlId = useId();
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [customBulkEditor, setCustomBulkEditor] = useState(false);
  const [bulkIds, setBulkIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("Closed");
  const [savingBulk, setSavingBulk] = useState(false);
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
          enableRowSelection: true,
          enableMultiRowSelection: true,
          allowBulkEdit: true,
          allowBulkDelete: false,
          allowEdit: true,
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
        <label
          className="flex items-center gap-2"
          htmlFor={`${controlId}-icons`}
        >
          <Checkbox
            aria-label="Icons on desktop"
            checked={icons}
            id={`${controlId}-icons`}
            onCheckedChange={setIcons}
          />{" "}
          Icons on desktop
        </label>
        <label
          className="flex items-center gap-2"
          htmlFor={`${controlId}-narrow`}
        >
          <Checkbox
            aria-label="Narrow container"
            checked={narrow}
            id={`${controlId}-narrow`}
            onCheckedChange={setNarrow}
          />{" "}
          Narrow container
        </label>
        <label
          className="flex items-center gap-2"
          htmlFor={`${controlId}-views`}
        >
          <Checkbox
            aria-label="Saved views"
            checked={views}
            id={`${controlId}-views`}
            onCheckedChange={setViews}
          />{" "}
          Saved views
        </label>
        <label
          className="flex items-center gap-2"
          htmlFor={`${controlId}-bulk`}
        >
          <Checkbox
            aria-label="Custom onBulkEdit"
            checked={customBulkEditor}
            id={`${controlId}-bulk`}
            onCheckedChange={setCustomBulkEditor}
          />
          Custom onBulkEdit
        </label>
      </div>
      <p className="text-muted-foreground text-sm">
        Search any data column. Select multiple rows to edit them together;
        enable Custom onBulkEdit to try the application-owned editor.
      </p>
      <output>{activity}</output>
      <div style={{ maxWidth: narrow ? 620 : undefined }}>
        <DataTable
          getTableActions={getActions}
          getTableConfig={getConfig}
          initialData={rows}
          initialViews={[openView]}
          onBulkEdit={
            customBulkEditor
              ? (selected) => {
                  setBulkIds(selected.map((row) => String(row.original.id)));
                  setActivity(
                    `onBulkEdit received ${selected.length} selected items.`
                  );
                }
              : undefined
          }
          onRowSelectionStateChange={setSelection}
          rowSelection={selection}
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
      <Dialog
        onOpenChange={(open) => {
          if (!(open || savingBulk)) {
            setBulkIds([]);
          }
        }}
        open={bulkIds.length > 0}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {bulkIds.length} selected items</DialogTitle>
            <DialogDescription>
              This application-owned editor is opened by onBulkEdit. Only the
              selected records will change.
            </DialogDescription>
          </DialogHeader>
          <label
            className="grid gap-2 text-sm"
            htmlFor={`${controlId}-bulk-status`}
          >
            Status
            <Select
              onValueChange={(value) => {
                if (value) {
                  setBulkStatus(value);
                }
              }}
              value={bulkStatus}
            >
              <SelectTrigger
                aria-label="Bulk status"
                className="w-full"
                id={`${controlId}-bulk-status`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <DialogFooter>
            <Button
              disabled={savingBulk}
              onClick={() => setBulkIds([])}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={savingBulk}
              onClick={async () => {
                setSavingBulk(true);
                try {
                  await actions.bulkUpdate?.(bulkIds, { status: bulkStatus });
                  await Promise.all([
                    queryClient.invalidateQueries({
                      queryKey: ["tableData", "responsive-toolbar"],
                    }),
                    queryClient.invalidateQueries({
                      queryKey: [
                        "tableColumnCalculations",
                        "responsive-toolbar",
                      ],
                    }),
                  ]);
                  setActivity(
                    `Updated ${bulkIds.length} selected items to ${bulkStatus}.`
                  );
                  setSelection({});
                  setBulkIds([]);
                } finally {
                  setSavingBulk(false);
                }
              }}
            >
              Apply to selected items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
