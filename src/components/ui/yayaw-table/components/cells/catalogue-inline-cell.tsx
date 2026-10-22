"use client";

import type { Cell } from "@/components/ui/yayaw-table/tanstack";
import type { ReactNode } from "react";
import type {
  InlineEditColumnRuntimeConfig,
  InlineEditCommitResult,
} from "../../hooks/use-inline-edit-runtime";
import {
  canEditInlineFormField,
  validateInlineFormValue,
} from "../forms/inline-form";
import type { FormConfig, FormConfigContext } from "../forms/types";
import {
  InlineEditableCell,
  type InlineOptionSearch,
} from "./inline-editable-cell";

export function CatalogueInlineCell<TData extends Record<string, unknown>>({
  cell,
  context,
  config,
  inlineConfig,
  displayValue,
  onCommit,
}: {
  cell: Cell<TData, unknown>;
  context: FormConfigContext;
  config?: FormConfig;
  inlineConfig: InlineEditColumnRuntimeConfig;
  displayValue: ReactNode;
  onCommit: (value: unknown) => Promise<InlineEditCommitResult>;
}) {
  const field = config?.fields.find(
    (candidate) => candidate.name === inlineConfig.formField
  );
  if (!canEditInlineFormField(config, field, context)) {
    return displayValue;
  }
  const { searchOptions, resolveOptions } = field ?? {};
  const optionSearch: InlineOptionSearch | undefined =
    field && searchOptions
      ? {
          search: (query, signal) => searchOptions(query, context, signal),
          resolve: resolveOptions
            ? (values, signal) => resolveOptions(values, context, signal)
            : undefined,
          minLength: field.searchMinLength ?? 3,
          debounceMs: field.searchDebounceMs ?? 300,
        }
      : undefined;
  return (
    <InlineEditableCell
      cell={cell}
      displayValue={displayValue}
      formFieldDefinition={field}
      inlineConfig={inlineConfig}
      optionSearch={optionSearch}
      onCommit={async (value) => {
        const result = await validateInlineFormValue(
          config,
          inlineConfig.formField,
          value,
          context
        );
        return result.success ? await onCommit(result.committedValue) : result;
      }}
      rowData={cell.row.original}
    />
  );
}
