"use client";

import { useSetAtom } from "jotai";
import type { TableCatalogueConfig } from "../../hooks/use-table-config";
import { useLocale, useTableActions } from "../../providers/table-provider";
import type {
  DetailRecord,
  DetailRevertHandler,
  RecordDetailsConfig,
} from "../../utils/record-details";
import {
  catalogueFormAtom,
  openUpdateForm,
} from "../forms/atoms/catalogue-form-atoms";
import { RecordDetails } from "./record-details";

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
  const setFormState = useSetAtom(catalogueFormAtom);
  const locale = useLocale();
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
    onClose();
    const type =
      tableConfig.form?.resolveEditFormType?.(item) ??
      tableConfig.form?.editFormType ??
      formType;
    setFormState(
      openUpdateForm(
        type,
        tableId,
        item,
        async () => {
          await onRefresh();
        },
        tableType
      )
    );
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
      config={details}
      key={idOf(current)}
      locale={locale}
      onClose={onClose}
      onDelete={canDelete ? remove : undefined}
      onDeleted={async () => {
        await onRefresh();
      }}
      onEdit={canEdit ? edit : undefined}
      onRevertActivity={onRevertActivity}
      onReverted={async () => {
        await onRefresh();
      }}
      row={current}
    />
  );
}
