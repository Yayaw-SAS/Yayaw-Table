"use client";

import { useStore } from "@tanstack/react-form";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { useTableConfig } from "../../hooks/use-table-config";
import {
  type TableActions,
  useFormConfig,
  useTableActions,
  useTranslations,
} from "../../providers/table-provider";
import { bulkEditorMessages } from "../../utils/bulk-editor";
import { BulkEditorFields } from "./bulk-editor-fields";
import { BulkEditorSurface } from "./bulk-editor-surface";
import {
  bulkCompletion,
  bulkFieldEditable,
  bulkFormConfig,
  bulkFormValues,
  commonBulkValues,
  validateBulkDraft,
} from "./bulk-form";
import { formValuesEqual, initialFormValues } from "./form-runtime";
import { generateFormConfig } from "./generated-form-config";
import { useFormBuilder } from "./hooks/use-form-builder";
import type { FieldValues, FormConfigContext } from "./types";

export interface BulkEditTarget {
  id: string;
  selectionId?: string;
  row: FieldValues;
}

interface BulkEditorProps {
  targets: BulkEditTarget[];
  tableId: string;
  tableType: string;
  onClose: () => void;
  onCompleted: (ids: string[]) => Promise<void>;
}
export function CatalogueBulkEditor(
  props: Omit<BulkEditorProps, "targets"> & { targets: BulkEditTarget[] | null }
) {
  return props.targets ? (
    <BulkEditorForm {...props} targets={props.targets} />
  ) : null;
}

/** A bulk draft owns its targets. Changes to the live table selection never add targets. */
function BulkEditorForm({
  targets,
  tableId,
  tableType,
  onClose,
  onCompleted,
}: {
  targets: BulkEditTarget[];
  tableId: string;
  tableType: string;
  onClose: () => void;
  onCompleted: (ids: string[]) => Promise<void>;
}) {
  const { config: tableConfig } = useTableConfig(tableType);
  const getFormConfig = useFormConfig();
  const getActions = useTableActions();
  const { locale, translations } = useTranslations();
  const messages = {
    ...bulkEditorMessages(locale),
    ...translations.bulk?.editor,
  };
  const [remaining, setRemaining] = useState(targets);
  const [applied, setApplied] = useState<string[]>([]);
  const initial = useMemo(
    () => commonBulkValues(targets.map((target) => target.row)),
    [targets]
  );
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const formTypes = [
    ...new Set(
      remaining.map(
        (target) =>
          tableConfig.form?.resolveEditFormType?.(target.row) ??
          tableConfig.form?.editFormType ??
          tableType
      )
    ),
  ];
  const formType = formTypes[0] ?? tableType;
  const context = useMemo<FormConfigContext>(
    () => ({
      formType,
      tableType,
      tableId,
      mode: "edit",
      initialData: initial,
      values,
      bulkEdit: {
        ids: remaining.map((target) => target.id),
        rows: remaining.map((target) => target.row),
        fields: applied,
      },
    }),
    [formType, tableType, tableId, initial, values, remaining, applied]
  );
  const config = useMemo(
    () =>
      getFormConfig?.(formType, context) ??
      generateFormConfig(
        formType,
        tableConfig.columns.definitions,
        values,
        remaining.map((target) => target.row)
      ),
    [
      getFormConfig,
      formType,
      context,
      tableConfig.columns.definitions,
      values,
      remaining,
    ]
  );
  const editable = config.fields.filter((field) =>
    bulkFieldEditable(field, context)
  );
  const validationConfig = useMemo(
    () => bulkFormConfig(config, context),
    [config, context]
  );
  const [draftState, setDraftState] = useState<{
    valid: boolean;
    clearValues: FieldValues;
  }>({ valid: false, clearValues: {} });
  useEffect(() => {
    let cancelled = false;
    setDraftState((previous) => ({ ...previous, valid: false }));
    validateBulkDraft(validationConfig, context)
      .then((next) => {
        if (!cancelled) {
          setDraftState(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDraftState({ valid: false, clearValues: {} });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [validationConfig, context]);
  const canSave = () =>
    tableConfig.table.allowBulkEdit !== false &&
    formTypes.length === 1 &&
    remaining.every(
      (target) => tableConfig.table.canEditRow?.(target.row) !== false
    );
  const eligibility = useRef(canSave);
  eligibility.current = canSave;
  const builder = useFormBuilder({
    config: validationConfig,
    context,
    initialData: initial,
    onValuesChange: (next) =>
      setValues((previous) =>
        formValuesEqual(previous, next) ? previous : next
      ),
    formOptions: {
      onSubmit: async (validated) => {
        if (busy) {
          return;
        }
        if (!canSave()) {
          setError(
            "These rows cannot share a bulk editor or are no longer editable."
          );
          return;
        }
        if (!validationConfig.fields.length) {
          setError("Choose at least one field to apply.");
          return;
        }
        setBusy(true);
        setError(undefined);
        try {
          const patch = bulkFormValues(validationConfig, validated);
          const payload = config.transform
            ? await config.transform(patch, context)
            : patch;
          if (!eligibility.current()) {
            throw new Error("These rows are no longer editable.");
          }
          const result = await getActions?.(tableType)?.bulkUpdate?.(
            remaining.map((target) => target.id),
            payload
          );
          await completeUpdate(result);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          setBusy(false);
        }
      },
    },
  });
  async function completeUpdate(
    result:
      | Awaited<ReturnType<NonNullable<TableActions["bulkUpdate"]>>>
      | undefined
  ) {
    if (!result) {
      throw new Error("Bulk update is not configured.");
    }
    const progress = bulkCompletion(
      remaining.map((target) => target.id),
      result
    );
    if (progress.completed.length) {
      setRemaining((previous) =>
        previous.filter((target) => progress.remaining.includes(target.id))
      );
      await onCompleted(progress.completed);
    }
    if (!result.success) {
      builder.form.setErrorMap({
        onServer: { fields: result.fieldErrors ?? {} },
      } as never);
      throw new Error(
        result.error ??
          "Some rows could not be updated. Retry the remaining rows."
      );
    }
    onClose();
  }
  const validatingOrSubmitting = useStore(
    builder.form.store,
    (state) => state.isSubmitting
  );
  const working = busy || validatingOrSubmitting;
  const count = remaining.length;
  return (
    <BulkEditorSurface
      busy={working}
      closeLabel={messages.close}
      description={messages.description}
      onClose={onClose}
      title={(count === 1 ? messages.titleOne : messages.titleMany).replace(
        "{count}",
        String(count)
      )}
    >
      <form
        className="flex min-h-0 flex-col"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!working && draftState.valid) {
            await builder.form.handleSubmit();
          }
        }}
      >
        <div className="min-h-0 overflow-y-auto overscroll-contain px-6 pb-5">
          {formTypes.length > 1 && (
            <p role="alert">Select rows using the same form type.</p>
          )}
          {error && (
            <p className="mb-4 text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
          <BulkEditorFields
            available={editable.filter(
              (field) => !applied.includes(field.name)
            )}
            clearValues={draftState.clearValues}
            context={context}
            disabled={working || !canSave()}
            fields={builder.fields}
            form={builder.form}
            messages={messages}
            onAdd={(name) => {
              if (builder.form.getFieldValue(name) === undefined) {
                builder.form.setFieldValue(
                  name,
                  initialFormValues(config, initial)[name]
                );
              }
              setApplied((previous) =>
                previous.includes(name) ? previous : [...previous, name]
              );
            }}
            onRemove={(name) =>
              setApplied((previous) =>
                previous.filter((field) => field !== name)
              )
            }
          />
        </div>
        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            disabled={working}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            {messages.cancel}
          </Button>
          <Button
            disabled={working || !canSave() || !draftState.valid}
            type="submit"
          >
            {working
              ? messages.saving
              : (count === 1 ? messages.applyOne : messages.applyMany).replace(
                  "{count}",
                  String(count)
                )}
          </Button>
        </footer>
      </form>
    </BulkEditorSurface>
  );
}
