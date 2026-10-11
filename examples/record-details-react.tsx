"use client";

import { useRef, useState } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import type {
  DetailPresentation,
  DetailRecord,
  DetailRevertHandler,
} from "../src/components/ui/yayaw-table/utils/record-details";
import {
  customFieldEntries,
  detailExampleRow,
  recordDetailsConfig,
  recordExampleColumns,
  redoExampleRecord,
  revertExampleRecord,
  updateExampleRecord,
} from "./record-details";

const config = defineTableConfig({
  id: "record-details-react",
  columns: {
    definitions: recordExampleColumns,
    visible: recordExampleColumns.map((column) => column.id),
    order: recordExampleColumns.map((column) => column.id),
    mandatory: [],
  },
  table: {
    syncUrl: false,
    rowClickMode: "activate",
    enableRowClickEdit: false,
    allowCreate: false,
    allowDuplicate: false,
    enableRowSelection: false,
    enableViews: false,
    showToolbarHeader: false,
    allowEdit: true,
    allowDelete: true,
  },
  translations: { namespace: "record-details-react", keys: {} },
});

/** Mount inside NuqsAdapter and the application QueryClientProvider. All mutations and audit entries stay in memory. */
export function RecordDetailsExample() {
  const [rows, setRows] = useState<DetailRecord[]>([
    structuredClone(detailExampleRow),
  ]);
  const current = useRef(rows);
  const [presentation, setPresentation] =
    useState<DetailPresentation>("drawer");
  const [revision, setRevision] = useState(0);
  const [feedback, setFeedback] = useState("");
  const replaceRows = (next: DetailRecord[]) => {
    current.current = next;
    setRows(next);
  };
  const actions: TableActions = {
    list: async () => ({
      data: current.current,
      meta: { pageCount: 1, totalCount: current.current.length },
    }),
    update: (id, patch) => {
      replaceRows(
        current.current.map((row) =>
          row.id === id ? updateExampleRecord(row, patch) : row
        )
      );
      return Promise.resolve({ success: true });
    },
    delete: (id) => {
      replaceRows(current.current.filter((row) => row.id !== id));
      return Promise.resolve({ success: true });
    },
  };
  const revert: DetailRevertHandler = (row, event) => {
    const latest = current.current.find((item) => item.id === row.id);
    if (!latest) {
      return { success: false, error: "Cette entrée n’existe plus." };
    }
    const restored = revertExampleRecord(latest, event);
    replaceRows(
      current.current.map((item) => (item.id === row.id ? restored : item))
    );
    return { success: true };
  };
  const redo: DetailRevertHandler = (row, event) => {
    const latest = current.current.find((item) => item.id === row.id);
    if (!latest) {
      return { success: false, error: "Cette entrée n’existe plus." };
    }
    const redone = redoExampleRecord(latest, event);
    replaceRows(
      current.current.map((item) => (item.id === row.id ? redone : item))
    );
    return { success: true };
  };
  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <header>
        <p className="text-muted-foreground text-sm">YaYaw Table · React</p>
        <h1 className="font-semibold text-3xl">La fiche de consultation</h1>
        <p>
          30 champs, une date de mise à jour et un historique qui conserve
          chaque action.
        </p>
      </header>
      <fieldset className="flex gap-6">
        <legend>Présentation de la fiche</legend>
        {(
          [
            ["drawer", "Panneau latéral"],
            ["modal", "Modale"],
            ["inline", "Dans la page"],
          ] as const
        ).map(([value, label]) => (
          <label className="flex items-center gap-2" key={value}>
            <input
              checked={presentation === value}
              name="presentation"
              onChange={() => setPresentation(value)}
              type="radio"
              value={value}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <DataTable
        details={{
          ...recordDetailsConfig,
          presentation,
          // The related list's actions belong to the host: a real application opens or creates the contact.
          onRelatedAction: ({ kind, related }) => {
            setFeedback(
              kind === "open"
                ? `Ouvrir le contact ${String(related?.name ?? "")}.`
                : "Ajouter un contact à la campagne."
            );
          },
          renderSection: (section, row) =>
            section.id === "custom-fields" ? (
              <dl className="grid gap-2 text-sm">
                {customFieldEntries(row, section.data?.column).map(
                  ([label, value]) => (
                    <div className="flex gap-3" key={label}>
                      <dt className="min-w-32 text-muted-foreground">
                        {label}
                      </dt>
                      <dd>{value}</dd>
                    </div>
                  )
                )}
              </dl>
            ) : undefined,
        }}
        getTableActions={() => actions}
        getTableConfig={() => config}
        initialData={rows}
        initialPageCount={1}
        initialRowCount={rows.length}
        key={`${presentation}-${revision}`}
        locale="fr"
        onRedoActivity={redo}
        onRevertActivity={revert}
        tableType="record-details-react"
      />
      <footer className="flex justify-between text-muted-foreground text-sm">
        <output>
          {feedback ||
            "Données et historique fictifs · Les modifications restent dans cette démo."}
        </output>
        <button
          onClick={() => {
            replaceRows([structuredClone(detailExampleRow)]);
            setRevision((value) => value + 1);
          }}
          type="button"
        >
          Réinitialiser
        </button>
      </footer>
    </main>
  );
}
