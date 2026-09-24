"use client";

import { useMemo } from "react";
import { useFormConfig } from "../../../providers/table-provider";
import { formCreateFields } from "../../../utils/form-view";
import { createFormConfigContext } from "./use-form-catalogue";

/**
 * The fields of the table's create form (`getFormConfig` for its create form
 * type), when the host declares one: the Form mode asks only these columns.
 */
export function useCreateFormFields({
  createFormType,
  formType: tableFormType,
  tableId,
  tableType,
}: {
  /** `form.createFormType` of the table config, when set. */
  createFormType?: string;
  /** The table's form type, else. */
  formType: string;
  tableId: string;
  tableType: string;
}): readonly string[] | undefined {
  const getFormConfig = useFormConfig();
  const formType = createFormType ?? tableFormType;
  return useMemo(() => {
    if (!getFormConfig) {
      return;
    }
    const context = createFormConfigContext({
      formType,
      mode: "create",
      tableId,
      tableType,
    });
    try {
      return formCreateFields(getFormConfig(formType, context)?.fields);
    } catch {
      // A host form that cannot be built without a record limits nothing.
      return;
    }
  }, [formType, getFormConfig, tableId, tableType]);
}
