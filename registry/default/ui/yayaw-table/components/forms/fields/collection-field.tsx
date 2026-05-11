/**
 * Collection field component for array-like form values.
 */
"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Fragment, useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useTranslations } from "../../../providers/table-provider";
import type {
  CollectionFieldActionLabels,
  CollectionFieldColumnDefinition,
  CollectionFieldCreateAction,
  CollectionFieldDefinition,
  FieldValues,
  FormFieldApi,
} from "../types";
import {
  type CollectionItem,
  cloneCollectionItem,
  getCollectionItemErrors,
  getCollectionValidationResult,
  insertCollectionItem,
  moveCollectionItem,
  normalizeCollectionItems,
  removeCollectionItem,
  replaceCollectionItem,
} from "./collection-field-utils";

interface CollectionEditorState {
  draft: CollectionItem;
  index: number | null;
  mode: "create" | "edit";
}

export interface CollectionEditorProps {
  addLabel: string;
  columns: CollectionFieldColumnDefinition[];
  createActions?: CollectionFieldCreateAction[];
  createItem: (items: readonly CollectionItem[]) => CollectionItem;
  description?: ReactNode;
  disabled?: boolean;
  emptyLabel?: string;
  errors?: string[];
  getItemKey?: (item: CollectionItem, index: number) => string;
  id?: string;
  itemLabel: string;
  label?: ReactNode;
  labelKeys?: Partial<Record<keyof CollectionFieldActionLabels, string>>;
  labels?: Partial<CollectionFieldActionLabels>;
  onChange: (items: CollectionItem[]) => void;
  renderItemForm: (props: {
    disabled?: boolean;
    index: number | null;
    item: CollectionItem;
    onChange: (item: CollectionItem) => void;
  }) => ReactNode;
  validateItem?: (item: CollectionItem, index: number | null) => string[];
  validateItems?: (items: readonly CollectionItem[]) => string[];
  value: unknown;
}

interface ResolvedCollectionLabels extends CollectionFieldActionLabels {
  addTitle: string;
  editTitle: string;
}

function uniqueMessages(messages: readonly string[]): string[] {
  return [...new Set(messages.filter(Boolean))];
}

function translateWithFallback(
  t: (key: string) => string,
  key: string,
  fallback: string
): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function resolveCollectionLabels({
  itemLabel,
  labelKeys,
  labels,
  t,
}: {
  itemLabel: string;
  labelKeys?: Partial<Record<keyof CollectionFieldActionLabels, string>>;
  labels?: Partial<CollectionFieldActionLabels>;
  t: (key: string) => string;
}): ResolvedCollectionLabels {
  const fallbackLabels: CollectionFieldActionLabels = {
    actions: translateWithFallback(t, "collection.actions", "Actions"),
    addTitle: `Add ${itemLabel}`,
    cancel: translateWithFallback(t, "collection.cancel", "Cancel"),
    deleteItem: translateWithFallback(t, "collection.deleteItem", "Delete"),
    editItem: translateWithFallback(t, "collection.editItem", "Edit"),
    editTitle: `Edit ${itemLabel}`,
    moveDown: translateWithFallback(t, "collection.moveDown", "Move down"),
    moveUp: translateWithFallback(t, "collection.moveUp", "Move up"),
    save: translateWithFallback(t, "collection.save", "Save"),
  };

  const resolvedEntries = Object.entries(fallbackLabels).map(
    ([name, fallback]) => {
      const typedName = name as keyof CollectionFieldActionLabels;
      const key = labelKeys?.[typedName];
      if (key) {
        return [typedName, t(key)];
      }
      return [typedName, labels?.[typedName] ?? fallback];
    }
  );

  return Object.fromEntries(resolvedEntries) as ResolvedCollectionLabels;
}

function formatCollectionValue(value: unknown): ReactNode {
  if (value == null || value === "") {
    return <span className="text-muted-foreground">-</span>;
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }
  return (
    <code className="rounded bg-muted px-1 py-0.5 text-xs">
      {JSON.stringify(value)}
    </code>
  );
}

function renderCollectionCell(
  column: CollectionFieldColumnDefinition,
  item: CollectionItem,
  index: number
): ReactNode {
  if (column.render) {
    return column.render(item, index);
  }
  return formatCollectionValue(item[column.id]);
}

function getEditorTitle(
  state: CollectionEditorState,
  labels: ResolvedCollectionLabels
): string {
  if (state.mode === "create") {
    return labels.addTitle;
  }
  return `${labels.editTitle} ${state.index == null ? "" : state.index + 1}`.trim();
}

export function CollectionEditor({
  addLabel,
  columns,
  createActions,
  createItem,
  description,
  disabled,
  emptyLabel,
  errors = [],
  getItemKey,
  id,
  itemLabel,
  label,
  labelKeys,
  labels,
  onChange,
  renderItemForm,
  validateItem,
  validateItems,
  value,
}: CollectionEditorProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const { t } = useTranslations();
  const items = useMemo(() => normalizeCollectionItems(value), [value]);
  const [editorState, setEditorState] = useState<CollectionEditorState | null>(
    null
  );
  const resolvedLabels = useMemo(
    () => resolveCollectionLabels({ itemLabel, labelKeys, labels, t }),
    [itemLabel, labelKeys, labels, t]
  );
  const validation = useMemo(
    () =>
      getCollectionValidationResult(
        { itemLabel, validateItem, validateItems },
        items
      ),
    [itemLabel, items, validateItem, validateItems]
  );
  const visibleErrors = uniqueMessages([...validation.globalErrors, ...errors]);
  const isInvalid = validation.messages.length > 0 || visibleErrors.length > 0;
  const visibleColumns =
    columns.length > 0
      ? columns
      : [
          {
            header: itemLabel,
            id: "value",
          } satisfies CollectionFieldColumnDefinition,
        ];
  const addActions =
    createActions && createActions.length > 0
      ? createActions
      : [{ createItem, label: addLabel }];

  const openCreateEditor = (
    actionCreateItem: (items: readonly CollectionItem[]) => CollectionItem
  ) => {
    setEditorState({
      draft: cloneCollectionItem(actionCreateItem(items)),
      index: null,
      mode: "create",
    });
  };

  const openEditEditor = (item: CollectionItem, index: number) => {
    setEditorState({
      draft: cloneCollectionItem(item),
      index,
      mode: "edit",
    });
  };

  const closeEditor = () => {
    setEditorState(null);
  };

  const saveEditor = () => {
    if (!editorState) {
      return;
    }
    const nextItems =
      editorState.index == null
        ? insertCollectionItem(items, editorState.draft)
        : replaceCollectionItem(items, editorState.index, editorState.draft);
    onChange(nextItems);
    closeEditor();
  };

  const draftErrors = editorState
    ? getCollectionItemErrors(
        { validateItem },
        editorState.draft,
        editorState.index
      )
    : [];

  return (
    <Field
      aria-describedby={description ? `${fieldId}-description` : undefined}
      aria-invalid={isInvalid}
      className="gap-3"
      data-invalid={isInvalid}
    >
      {label && <FieldLabel>{label}</FieldLabel>}
      {description && (
        <FieldDescription id={`${fieldId}-description`}>
          {description}
        </FieldDescription>
      )}

      <div className="rounded-md border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <div className="text-muted-foreground text-sm">
            {items.length} {itemLabel}
          </div>
          <div className="flex flex-wrap gap-2">
            {addActions.map((action) => (
              <Button
                disabled={disabled}
                key={action.id ?? action.label}
                onClick={() => openCreateEditor(action.createItem)}
                size="sm"
                type="button"
                variant="outline"
              >
                <PlusIcon />
                <span>{action.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-4 text-muted-foreground text-sm">
            {emptyLabel ?? `No ${itemLabel.toLowerCase()} yet.`}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.map((column) => (
                  <TableHead key={column.id}>{column.header}</TableHead>
                ))}
                <TableHead className="w-36 text-right">
                  {resolvedLabels.actions}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const rowErrors = validation.itemErrors[index] ?? [];
                const rowInvalid = rowErrors.length > 0;
                const itemKey =
                  getItemKey?.(item, index) ?? `${index}-${itemLabel}`;
                return (
                  <Fragment key={itemKey}>
                    <TableRow
                      aria-invalid={rowInvalid}
                      className={cn(rowInvalid && "bg-destructive/5")}
                      data-invalid={rowInvalid}
                    >
                      {visibleColumns.map((column) => (
                        <TableCell key={column.id}>
                          {renderCollectionCell(column, item, index)}
                        </TableCell>
                      ))}
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            aria-label={`${resolvedLabels.moveUp} ${itemLabel} ${index + 1}`}
                            disabled={disabled || index === 0}
                            onClick={() =>
                              onChange(
                                moveCollectionItem(items, index, index - 1)
                              )
                            }
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                          >
                            <ArrowUpIcon />
                          </Button>
                          <Button
                            aria-label={`${resolvedLabels.moveDown} ${itemLabel} ${index + 1}`}
                            disabled={disabled || index === items.length - 1}
                            onClick={() =>
                              onChange(
                                moveCollectionItem(items, index, index + 1)
                              )
                            }
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                          >
                            <ArrowDownIcon />
                          </Button>
                          <Button
                            aria-label={`${resolvedLabels.editItem} ${itemLabel} ${index + 1}`}
                            disabled={disabled}
                            onClick={() => openEditEditor(item, index)}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                          >
                            <PencilIcon />
                          </Button>
                          <Button
                            aria-label={`${resolvedLabels.deleteItem} ${itemLabel} ${index + 1}`}
                            disabled={disabled}
                            onClick={() =>
                              onChange(removeCollectionItem(items, index))
                            }
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {rowInvalid && (
                      <TableRow key={`${itemKey}-errors`}>
                        <TableCell colSpan={visibleColumns.length + 1}>
                          <FieldError
                            errors={rowErrors.map((message) => ({ message }))}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <FieldError errors={visibleErrors.map((message) => ({ message }))} />

      {editorState && (
        <Dialog
          onOpenChange={(open) => {
            if (!open) {
              closeEditor();
            }
          }}
          open
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {getEditorTitle(editorState, resolvedLabels)}
              </DialogTitle>
              {draftErrors.length > 0 && (
                <DialogDescription>
                  {draftErrors.length === 1
                    ? draftErrors[0]
                    : `${draftErrors.length} validation errors`}
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="space-y-4">
              {renderItemForm({
                disabled,
                index: editorState.index,
                item: editorState.draft,
                onChange: (item) =>
                  setEditorState((current) =>
                    current
                      ? { ...current, draft: cloneCollectionItem(item) }
                      : current
                  ),
              })}
              <FieldError
                errors={draftErrors.map((message) => ({ message }))}
              />
            </div>
            <DialogFooter>
              <Button onClick={closeEditor} type="button" variant="outline">
                {resolvedLabels.cancel}
              </Button>
              <Button disabled={disabled} onClick={saveEditor} type="button">
                {resolvedLabels.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Field>
  );
}

interface CollectionFieldProps<TFieldValues extends FieldValues> {
  field: CollectionFieldDefinition<TFieldValues>;
  fieldApi: FormFieldApi<unknown>;
}

export function CollectionField<TFieldValues extends FieldValues>({
  field,
  fieldApi,
}: CollectionFieldProps<TFieldValues>) {
  const { t } = useTranslations();
  const errors = fieldApi.state.meta.errors;
  const errorMessages = Array.isArray(errors)
    ? errors.map((error) => (typeof error === "string" ? error : String(error)))
    : [];

  useEffect(() => {
    if (!Array.isArray(fieldApi.state.value)) {
      fieldApi.handleChange([]);
    }
  }, [fieldApi.handleChange, fieldApi.state.value]);

  return (
    <CollectionEditor
      addLabel={field.addLabel}
      columns={field.columns}
      createActions={field.createActions}
      createItem={field.createItem}
      description={
        field.descriptionKey ? t(field.descriptionKey) : field.description
      }
      disabled={field.disabled}
      emptyLabel={field.emptyLabel}
      errors={errorMessages}
      getItemKey={field.getItemKey}
      itemLabel={field.itemLabel}
      label={field.labelKey ? t(field.labelKey) : field.label}
      labelKeys={field.labelKeys}
      labels={field.labels}
      onChange={fieldApi.handleChange}
      renderItemForm={field.renderItemForm}
      validateItem={field.validateItem}
      validateItems={field.validateItems}
      value={fieldApi.state.value}
    />
  );
}
