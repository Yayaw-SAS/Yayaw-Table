"use client";

import { useId } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/src/components/ui/field";
import type { TagCatalogApi } from "../../providers/tag-catalog-provider";
import { useTranslations } from "../../providers/table-provider";
import type { ResolvedTagColumn } from "../../utils/tag-catalog";
import type { FormFieldApi } from "../forms/types";
import { TagPicker } from "./tag-picker";

interface TagFieldDefinition {
  name: unknown;
  label: string;
  labelKey?: string;
  description?: string;
  descriptionKey?: string;
  placeholder?: string;
  placeholderKey?: string;
  disabled?: unknown;
}

/**
 * A record form field bound to a tags column: the catalog's tags as colored
 * chips, search, and "Create “name”" when the host can create tags.
 */
export function TagField({
  catalog,
  column,
  field,
  fieldApi,
}: {
  catalog: TagCatalogApi;
  column: ResolvedTagColumn;
  field: TagFieldDefinition;
  fieldApi: FormFieldApi<unknown>;
}) {
  const { t } = useTranslations();
  const controlId = useId();
  const errors = fieldApi.state.meta.errors;
  const errorMessages = Array.isArray(errors)
    ? errors.map((error) => (typeof error === "string" ? error : String(error)))
    : [];
  const label = field.labelKey ? t(field.labelKey) : field.label;
  const description = field.descriptionKey
    ? t(field.descriptionKey)
    : field.description;
  const loading = catalog.status(column.columnId) === "loading";
  return (
    <Field data-invalid={!fieldApi.state.meta.isValid}>
      <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
      <TagPicker
        coloredTags={catalog.coloredTags(column.columnId)}
        describedBy={description ? `${controlId}-help` : undefined}
        disabled={field.disabled === true}
        id={controlId}
        invalid={!fieldApi.state.meta.isValid}
        label={label}
        labels={catalog.labels}
        mode="field"
        multiple={column.multiple}
        onChange={(next) => {
          fieldApi.handleChange(next);
          fieldApi.handleBlur();
        }}
        onCreate={
          catalog.canCreate(column.columnId)
            ? (name) => catalog.create(column.columnId, name)
            : undefined
        }
        placeholder={
          (field.placeholderKey ? t(field.placeholderKey) : field.placeholder) ??
          undefined
        }
        tags={catalog.tags(column.columnId)}
        value={fieldApi.state.value}
      />
      {loading ? (
        <output className="text-muted-foreground text-xs">
          {catalog.labels.loading}
        </output>
      ) : null}
      {description ? (
        <FieldDescription id={`${controlId}-help`}>{description}</FieldDescription>
      ) : null}
      <FieldError errors={errorMessages.map((message) => ({ message }))} />
    </Field>
  );
}
