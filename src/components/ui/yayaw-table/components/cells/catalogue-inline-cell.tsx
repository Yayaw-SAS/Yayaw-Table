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
import { InlineEditableCell } from "./inline-editable-cell";

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
  return (
    <InlineEditableCell
      cell={cell}
      displayValue={displayValue}
      formFieldDefinition={field}
      inlineConfig={inlineConfig}
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
