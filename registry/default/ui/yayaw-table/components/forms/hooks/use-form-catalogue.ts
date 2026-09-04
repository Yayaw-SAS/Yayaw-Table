/**
 * Hook for using form configurations from the catalogue
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TableConfig } from "../../../config/helpers";
import {
  useFormConfig,
  useTableActions,
  useTableConfig,
} from "../../../providers/table-provider";

import { formSubmissionValues, initialFormValues } from "../form-runtime";
import { generateFormConfig } from "../generated-form-config";
import type {
  FieldValues,
  FormConfig,
  FormConfigContext,
  FormConfigMode,
} from "../types";
import { useFormBuilder } from "./use-form-builder";

export interface UseFormCatalogueOptions<TFieldValues extends FieldValues> {
  /**
   * Type of form to use (corresponds to a key in the form catalogue)
   */
  formType: string;
  enabled?: boolean;

  /**
   * Initial data for the form (used for update operations)
   */
  initialData?: Partial<TFieldValues>;

  /**
   * Mode of the form (create or update)
   */
  mode?: "create" | "update";

  /**
   * Stable table instance id used for URL state, cache, selection, and invalidation
   */
  tableId?: string;

  /**
   * Table configuration type used to resolve columns/actions/configuration
   */
  tableType?: string;

  /**
   * Optional wrapper for submit (e.g. loading, toast). Receives validated values and the actual submit function.
   * The wrapper can use form from its closure (e.g. via a ref updated after useFormCatalogue returns).
   */
  onFormSubmit?: (
    values: TFieldValues,
    doSubmit: (values: TFieldValues) => Promise<unknown>
  ) => Promise<void>;
}

export function resolveFormConfigMode(
  mode: "create" | "update"
): FormConfigMode {
  return mode === "update" ? "edit" : "create";
}

function areFieldValuesEqual(
  left: Partial<FieldValues> | undefined,
  right: Partial<FieldValues> | undefined
): boolean {
  if (left === right) {
    return true;
  }

  try {
    return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
  } catch {
    return false;
  }
}

export function createFormConfigContext<
  TFieldValues extends FieldValues = FieldValues,
>({
  formType,
  initialData,
  mode,
  tableId,
  tableType,
  values,
}: {
  formType: string;
  initialData?: Partial<TFieldValues>;
  mode: "create" | "update";
  tableId?: string;
  tableType?: string;
  values?: Partial<TFieldValues>;
}): FormConfigContext<TFieldValues> {
  const resolvedTableId = tableId || tableType || formType;
  const resolvedTableType = tableType || tableId || formType;

  return {
    formType,
    initialData,
    mode: resolveFormConfigMode(mode),
    row:
      mode === "update" && initialData
        ? (initialData as Record<string, unknown>)
        : undefined,
    tableId: resolvedTableId,
    tableType: resolvedTableType,
    values,
  };
}

/**
 * Hook for using form configurations from the catalogue
 * @param options Hook options
 * @returns Form builder result
 */
export function useFormCatalogue<TFieldValues extends FieldValues>({
  formType,
  initialData,
  mode = "create",
  onFormSubmit,
  tableId,
  tableType,
  enabled = true,
}: UseFormCatalogueOptions<TFieldValues>) {
  const getFormConfig = useFormConfig();
  const getTableActions = useTableActions();
  const getTableConfig = useTableConfig();
  const [currentValues, setCurrentValues] = useState<
    Partial<TFieldValues> | undefined
  >(initialData);
  const [loadedValues, setLoadedValues] = useState<
    Partial<TFieldValues> | undefined
  >(initialData);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const formConfigContext = useMemo(
    () =>
      createFormConfigContext<TFieldValues>({
        formType,
        initialData,
        mode,
        tableId,
        tableType,
        values: currentValues,
      }),
    [formType, initialData, mode, tableId, tableType, currentValues]
  );
  const tableConfig = getTableConfig?.(tableType || tableId || formType) as
    | TableConfig
    | undefined;
  const config =
    getFormConfig?.<TFieldValues>(formType, formConfigContext) ??
    (generateFormConfig(
      formType,
      tableConfig?.columns?.definitions ?? []
    ) as FormConfig<TFieldValues>);
  const latest = useRef({ config, formConfigContext });
  latest.current = { config, formConfigContext };
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reopen, form identity, mode and retry invalidate the load; current values must not restart it.
  useEffect(() => {
    const request = new AbortController();
    setLoadError(undefined);
    setLoadingInitial(false);
    setLoadedValues(initialData);
    if (!enabled) {
      return () => request.abort();
    }
    const input = latest.current;
    const loader = input.config.loadInitialValues;
    if (!loader) {
      return () => request.abort();
    }
    const initialize = async () => {
      setLoadingInitial(true);
      try {
        const loaded = await loader(
          initialData,
          input.formConfigContext,
          request.signal
        );
        if (!request.signal.aborted) {
          setLoadedValues({
            ...initialData,
            ...loaded,
          } as Partial<TFieldValues>);
        }
      } catch (error) {
        if (!request.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!request.signal.aborted) {
          setLoadingInitial(false);
        }
      }
    };
    initialize();
    return () => request.abort();
  }, [enabled, formType, tableId, tableType, mode, initialData, retry]);
  const actions =
    getTableActions?.(tableType || tableId || formType) ??
    getTableActions?.(formType) ??
    {};
  const builderRef = useRef<{ setErrorMap: (map: never) => void } | null>(null);
  const handleSubmit = async (values: TFieldValues) => {
    if (loadingInitial || loadError) {
      throw new Error(loadError ?? "The form is still loading");
    }
    const baseline = initialFormValues(config as FormConfig, loadedValues);
    const prepared = formSubmissionValues(
      config as FormConfig,
      values,
      baseline,
      formConfigContext
    );
    const payload = config.transform
      ? await config.transform(prepared, formConfigContext)
      : prepared;
    const row = initialData as FieldValues | undefined;
    const configuredId = row?.id ?? row?._id;
    if (mode === "update" && configuredId == null) {
      throw new Error(`ID not found for update operation on ${formType}`);
    }
    const updatePayload = { ...payload };
    updatePayload.id = undefined;
    const result =
      mode === "update"
        ? await actions.update?.(String(configuredId), updatePayload)
        : await actions.create?.(payload);
    if (!result?.success) {
      if (result && "fieldErrors" in result) {
        builderRef.current?.setErrorMap({
          onServer: { fields: result.fieldErrors },
        } as never);
      }
      throw new Error(result?.error ?? `Failed to ${mode} ${formType}`);
    }
    return result.data;
  };
  const builder = useFormBuilder<TFieldValues>({
    config,
    context: formConfigContext,
    initialData: loadedValues,
    onValuesChange: (values) =>
      setCurrentValues((previous) =>
        areFieldValuesEqual(previous, values) ? previous : values
      ),
    formOptions: {
      onSubmit: async (values) => {
        if (onFormSubmit) {
          await onFormSubmit(values, handleSubmit);
        } else {
          await handleSubmit(values);
        }
      },
    },
  });
  builderRef.current = builder.form;
  return {
    ...builder,
    config,
    handleSubmit,
    loadingInitial,
    loadError,
    retryInitial: () => setRetry((value) => value + 1),
  };
}
