/** Quick filters reuse catalogue options and the native column-filter state. */
export interface FilterBarOption {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
}

export interface FilterBarColumn {
  id: string;
  header: string;
  type?: string;
  enableFiltering?: boolean;
  options?: unknown;
}

export const filterValueKey = (value: unknown): string =>
  `${typeof value}:${String(value)}`;

export function filterValues(value: unknown): unknown[] {
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function filterBarOptions(
  column: FilterBarColumn,
  value: unknown,
  booleanLabels: { yes: string; no: string }
): FilterBarOption[] {
  const options: FilterBarOption[] = Array.isArray(column.options)
    ? column.options
    : [];
  const initial =
    options.length || column.type !== "boolean"
      ? options
      : [
          { value: true, label: booleanLabels.yes },
          { value: false, label: booleanLabels.no },
        ];
  const result = new Map(
    initial.map((option) => [filterValueKey(option.value), option])
  );
  // Retain selections loaded from saved views even if an option was removed.
  for (const selected of filterValues(value)) {
    if (!["string", "number", "boolean"].includes(typeof selected)) {
      continue;
    }
    const key = filterValueKey(selected);
    if (!result.has(key)) {
      result.set(key, {
        value: selected as FilterBarOption["value"],
        label: String(selected),
      });
    }
  }
  return [...result.values()];
}

export function filterBarColumns<T extends FilterBarColumn>(
  columns: T[],
  ids: string[] = []
): T[] {
  return [...new Set(ids)].flatMap((id) => {
    const column = columns.find((item) => item.id === id);
    return column &&
      column.enableFiltering !== false &&
      (Array.isArray(column.options) || column.type === "boolean")
      ? [column]
      : [];
  });
}

export function replaceColumnFilter<T extends { id: string; value: unknown }>(
  filters: T[],
  id: string,
  values: unknown[]
): { id: string; value: unknown }[] {
  const other = filters.filter((filter) => filter.id !== id);
  return values.length ? [...other, { id, value: values }] : other;
}
