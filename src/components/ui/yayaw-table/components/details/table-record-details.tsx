"use client";

import { useAtom } from "jotai";
import { lazy, Suspense, useState } from "react";
import type { TableCatalogueConfig } from "../../hooks/use-table-config";
import { usePlanningState } from "../../planning/react";
import { useLocale, useTableActions } from "../../providers/table-provider";
import type {
  DetailRecord,
  DetailRevertHandler,
  RecordDetailsConfig,
} from "../../utils/record-details";
import {
  catalogueFormAtom,
  closeForm,
  openUpdateForm,
} from "../forms/atoms/catalogue-form-atoms";
import { RecordDetails } from "./record-details";

const CatalogueForm = lazy(() =>
  import("../forms/catalogue-form").then((module) => ({
    default: module.CatalogueForm,
  }))
);

/** Connect consultation to the existing form and mutation contracts without coupling the renderer to a table. */
export function TableRecordDetails({
  row,
  details,
  rows,
  tableConfig,
  tableType,
  tableId,
  formType,
  getRowId,
  onClose,
  onRefresh,
  onRevertActivity,
}: {
  row?: DetailRecord;
  details?: RecordDetailsConfig;
  rows: DetailRecord[];
  tableConfig: TableCatalogueConfig;
  tableType: string;
  tableId: string;
  formType: string;
  getRowId?: (row: DetailRecord) => string;
  onClose: () => void;
  onRefresh: () => Promise<unknown>;
  onRevertActivity?: DetailRevertHandler;
}) {
  const [formState, setFormState] = useAtom(catalogueFormAtom);
  const [editorBusy, setEditorBusy] = useState(false);
  const editing =
    formState.isOpen &&
    formState.surfaceOwner === "details" &&
    formState.tableId === tableId;
  const locale = useLocale();
  const { session: planningSession } = usePlanningState();
  const getActions = useTableActions();
  const actions = getActions?.(tableType);
  if (!(details && row)) {
    return null;
  }
  const idOf = (item: DetailRecord) => getRowId?.(item) ?? String(item.id);
  const current = rows.find((item) => idOf(item) === idOf(row)) ?? row;
  const canEdit =
    tableConfig.table.allowEdit &&
    Boolean(actions?.update) &&
    tableConfig.table.canEditRow?.(current) !== false;
  const canDelete =
    tableConfig.table.allowDelete &&
    Boolean(actions?.delete) &&
    tableConfig.table.canDeleteRow?.(current) !== false;
  const edit = (item: DetailRecord) => {
    if (!canEdit) {
      return;
    }
    const type =
      tableConfig.form?.resolveEditFormType?.(item) ??
      tableConfig.form?.editFormType ??
      formType;
    setFormState({
      ...openUpdateForm(
        type,
        tableId,
        item,
        async () => {
          await onRefresh();
        },
        tableType
      ),
      surfaceOwner: "details",
    });
  };
  const remove = async (item: DetailRecord) => {
    if (!(canDelete && actions?.delete)) {
      return { success: false };
    }
    return await actions.delete(idOf(item));
  };
  return (
    <RecordDetails
      columns={tableConfig.columns.definitions}
      config={{
        ...details,
        presentation: tableConfig.presentation ?? details.presentation,
      }}
      editor={
        editing ? (
          <Suspense
            fallback={
              <output className="yayaw-record-body">
                {locale.startsWith("fr") ? "Chargement…" : "Loading…"}
              </output>
            }
          >
            <CatalogueForm embedded onBusyChange={setEditorBusy} />
          </Suspense>
        ) : undefined
      }
      editorBusy={editorBusy}
      key={idOf(current)}
      locale={locale}
      onClose={() => {
        if (editorBusy) {
          return;
        }
        if (editing) {
          setFormState(closeForm());
        }
        onClose();
      }}
      onDelete={canDelete ? remove : undefined}
      onDeleted={async () => {
        await onRefresh();
      }}
      onEdit={canEdit ? edit : undefined}
      onPlanning={
        planningSession
          ? (item) =>
              planningSession.open({
                source: planningSession.config.sourceId,
                id: idOf(item),
              })
          : undefined
      }
      onRevertActivity={onRevertActivity}
      onReverted={async () => {
        await onRefresh();
      }}
      row={current}
    />
  );
}
