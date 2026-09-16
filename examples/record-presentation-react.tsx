import { createRecordActivity } from "./record-activity";

("use client");

import { useMemo, useRef, useState } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import type { RecordPresentation } from "../src/components/ui/yayaw-table/utils/record-presentation";
import {
  presentationColumns,
  presentationDetails,
  presentationForm,
  presentationGallery,
  presentationRows,
} from "./record-presentation";

/** Open a record, edit it in place, or select several rows for the shared bulk surface. */
export function RecordPresentationExample() {
  const params = new URLSearchParams(window.location.search);
  const [desktop, setDesktop] = useState<RecordPresentation>(
    (params.get("desktop") as RecordPresentation) || "drawer"
  );
  const [mobile, setMobile] = useState<RecordPresentation>(
    (params.get("mobile") as RecordPresentation) || "drawer"
  );
  const [rows, setRows] = useState<Record<string, unknown>[]>(
    structuredClone(presentationRows)
  );
  const current = useRef(rows);
  const config = useMemo(
    () =>
      defineTableConfig({
        id: "record-presentation",
        presentation: { desktop, mobile },
        columns: {
          definitions: presentationColumns,
          order: presentationColumns.map((column) => column.id),
          visible: ["name", "category", "status", "price", "active"],
          mandatory: [],
        },
        table: {
          syncUrl: false,
          gallery: presentationGallery,
          coloredTags: false,
          defaultDisplayMode: "gallery",
          rowClickMode: "activate",
          displayModes: ["table", "gallery", "kanban"],
          kanban: { groupBy: "status" },
        },
        translations: { namespace: "records", keys: { title: "Products" } },
      }),
    [desktop, mobile]
  );
  const [activity] = useState(() =>
    createRecordActivity(presentationRows, (next) => {
      current.current = next;
      setRows(next);
    })
  );
  const actions = useMemo<TableActions>(
    () => ({
      ...activity,
      list: () =>
        Promise.resolve({
          data: current.current,
          meta: { pageCount: 1, totalCount: current.current.length },
        }),
    }),
    [activity]
  );
  const details = useMemo(
    () => ({
      ...presentationDetails,
      history: activity.history,
      labels: {
        deleteDescription:
          "Move this demo record to the trash. Ctrl/Cmd+Z restores it.",
      },
    }),
    [activity]
  );
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-2">
        <p className="text-muted-foreground text-sm">YaYaw Table · React</p>
        <h1 className="font-semibold text-2xl">Record presentation</h1>
        <p className="text-muted-foreground text-sm">
          Open a product to view and edit it. Select multiple products to edit
          shared properties. Ctrl/Cmd+A selects records; Ctrl/Cmd+Z undoes your
          latest change, including deletion.
        </p>
      </header>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          Desktop{" "}
          <select
            aria-label="Desktop presentation"
            className="rounded-md border bg-background px-3 py-2"
            onChange={(event) =>
              setDesktop(event.target.value as RecordPresentation)
            }
            value={desktop}
          >
            <option value="drawer">Drawer</option>
            <option value="modal">Modal</option>
            <option value="inline">Inline</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Mobile{" "}
          <select
            aria-label="Mobile presentation"
            className="rounded-md border bg-background px-3 py-2"
            onChange={(event) =>
              setMobile(event.target.value as RecordPresentation)
            }
            value={mobile}
          >
            <option value="drawer">Drawer</option>
            <option value="modal">Modal</option>
            <option value="inline">Inline</option>
          </select>
        </label>
      </div>
      <DataTable
        details={details}
        getFormConfig={() => presentationForm}
        getTableActions={() => actions}
        getTableConfig={() => config}
        initialData={rows}
        initialPageCount={1}
        initialRowCount={rows.length}
        onRevertActivity={activity.revert}
        tableType={config.id}
      />
    </main>
  );
}
