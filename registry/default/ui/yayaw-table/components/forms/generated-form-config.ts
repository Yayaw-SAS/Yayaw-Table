import type { AnyFieldDefinition, FormConfig, FormSelectOption } from "./types";

/** A catalogue may override any generated field with validation or a custom renderer. */
export function generateFormConfig(
  id: string,
  columns: Array<{
    id: string;
    header: string;
    type?: string;
    accessorKey?: unknown;
    options?: unknown;
  }>
): FormConfig {
  const fields: AnyFieldDefinition[] = columns
    .filter(
      (column) =>
        !["select", "actions"].includes(column.id) && column.type !== "actions"
    )
    .map((column) => {
      const name =
        typeof column.accessorKey === "string" ? column.accessorKey : column.id;
      const base = { name, label: column.header };
      switch (column.type) {
        case "boolean":
          return { ...base, type: "switch" };
        case "date":
          return { ...base, type: "date" };
        case "number":
          return { ...base, type: "number" };
        case "url":
          return { ...base, type: "url" };
        case "select":
        case "multiSelect":
          return {
            ...base,
            type: column.type,
            options: Array.isArray(column.options)
              ? (column.options as FormSelectOption[])
              : [],
          };
        default:
          return { ...base, type: "text" };
      }
    });
  return { id, fields, defaultValues: {} };
}
