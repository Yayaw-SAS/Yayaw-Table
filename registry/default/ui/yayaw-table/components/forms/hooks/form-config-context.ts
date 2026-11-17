import type { FieldValues, FormConfigContext, FormConfigMode } from "../types";

export function resolveFormConfigMode(
  mode: "create" | "update"
): FormConfigMode {
  return mode === "update" ? "edit" : "create";
}

export function createFormConfigContext<
  TFieldValues extends FieldValues = FieldValues,
>({
  formType,
  initialData,
  mode,
  tableId,
  tableType,
  values,
}: {
  formType: string;
  initialData?: Partial<TFieldValues>;
  mode: "create" | "update";
  tableId?: string;
  tableType?: string;
  values?: Partial<TFieldValues>;
}): FormConfigContext<TFieldValues> {
  const resolvedTableId = tableId || tableType || formType;
  const resolvedTableType = tableType || tableId || formType;

  return {
    formType,
    initialData,
    mode: resolveFormConfigMode(mode),
    row:
      mode === "update" && initialData
        ? (initialData as Record<string, unknown>)
        : undefined,
    tableId: resolvedTableId,
    tableType: resolvedTableType,
    values,
  };
}
