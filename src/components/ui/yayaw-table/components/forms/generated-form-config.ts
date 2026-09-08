import {
  type DataTypeColumn,
  generateDataTypeFields,
} from "../../utils/table-contracts";
import type { AnyFieldDefinition, FormConfig } from "./types";

/** A catalogue may override generated fields with validation or a custom renderer. */
export function generateFormConfig(
  id: string,
  columns: DataTypeColumn[],
  row?: Record<string, unknown>,
  rows: Record<string, unknown>[] = []
): FormConfig {
  return {
    id,
    fields: generateDataTypeFields(columns, row, rows) as AnyFieldDefinition[],
    defaultValues: {},
  };
}
