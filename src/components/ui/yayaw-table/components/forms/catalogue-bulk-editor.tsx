"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { useTableConfig } from "../../hooks/use-table-config";
import {
  type TableActions,
  useFormConfig,
  useTableActions,
} from "../../providers/table-provider";
import {
  bulkCompletion,
  bulkFieldEditable,
  bulkFormConfig,
  bulkFormValues,
  commonBulkValues,
} from "./bulk-form";
import { FormBuilder } from "./form-builder";
import { formValuesEqual } from "./form-runtime";
import { generateFormConfig } from "./generated-form-config";
import { useFormBuilder } from "./hooks/use-form-builder";
import type { FieldValues, FormConfigContext } from "./types";

export interface BulkEditTarget {
  id: string;
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
  const context: FormConfigContext = {
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
  };
  const config =
    getFormConfig?.(formType, context) ??
    generateFormConfig(formType, tableConfig.columns.definitions);
  const editable = config.fields.filter((field) =>
    bulkFieldEditable(field, context)
  );
  const validationConfig = bulkFormConfig(config, context);
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
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!(open || busy)) {
          onClose();
        }
      }}
      open
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogTitle>Bulk edit</DialogTitle>
        <DialogDescription>
          Only checked fields are applied to the {remaining.length} selected
          rows.
        </DialogDescription>
        {formTypes.length > 1 && (
          <p role="alert">Select rows using the same form type.</p>
        )}
        {error && <p role="alert">{error}</p>}
        <fieldset className="space-y-3" disabled={busy || !canSave()}>
          {editable.map((field) => (
            <label className="flex items-center gap-2" key={field.name}>
              <input
                checked={applied.includes(field.name)}
                onChange={(event) =>
                  setApplied((previous) =>
                    event.target.checked
                      ? [...previous, field.name]
                      : previous.filter((name) => name !== field.name)
                  )
                }
                type="checkbox"
              />
              Apply {field.label}
            </label>
          ))}
          <FormBuilder
            asFieldset
            context={context}
            fields={builder.fields}
            form={builder.form}
            sections={builder.sections}
          />
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button
            disabled={busy}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={busy || !canSave() || !validationConfig.fields.length}
            onClick={async () => {
              await builder.form.handleSubmit();
            }}
            type="button"
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
