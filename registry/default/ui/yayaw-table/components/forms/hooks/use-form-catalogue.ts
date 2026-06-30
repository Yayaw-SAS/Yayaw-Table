/**
 * Hook for using form configurations from the catalogue
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import {
  useFormConfig,
  useTableActions,
} from "../../../providers/table-provider";
import type {
  AnyFieldDefinition,
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

function createFallbackFormConfig<TFieldValues extends FieldValues>(
  formType: string
): FormConfig<TFieldValues> {
  return {
    id: formType,
    fields: [],
    defaultValues: {} as Partial<TFieldValues>,
    schema: z.any() as z.ZodType<TFieldValues>,
    sections: [],
    translations: {
      namespace: "common",
      keys: {},
    },
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
}: UseFormCatalogueOptions<TFieldValues>) {
  // Get the configuration helpers from the provider
  const getFormConfig = useFormConfig();
  const getTableActions = useTableActions();
  const [currentValues, setCurrentValues] = useState<
    Partial<TFieldValues> | undefined
  >(initialData);

  useEffect(() => {
    setCurrentValues((previousValues) =>
      areFieldValuesEqual(previousValues, initialData)
        ? previousValues
        : initialData
    );
  }, [initialData]);

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

  // Stabilize the form configuration object to prevent recreation
  const config = useMemo(() => {
    return (
      getFormConfig?.<TFieldValues>(formType, formConfigContext) ||
      createFallbackFormConfig<TFieldValues>(formType)
    );
  }, [getFormConfig, formType, formConfigContext]);

  // Stabilize the table actions object to prevent recreation
  const actions = useMemo(() => {
    const parentActionsKey = tableType || tableId || formType;
    return (
      getTableActions?.(parentActionsKey) || getTableActions?.(formType) || {}
    );
  }, [getTableActions, formType, tableId, tableType]);

  const handleValuesChange = useCallback((values: TFieldValues) => {
    setCurrentValues((previousValues) =>
      areFieldValuesEqual(previousValues, values) ? previousValues : values
    );
  }, []);

  // Helper function to sanitize a single field value
  const sanitizeFieldValue = useCallback(
    (
      _key: string,
      value: unknown,
      fieldDef: AnyFieldDefinition<TFieldValues> | undefined
    ): unknown => {
      if (!fieldDef) {
        return value;
      }

      // Handle JSON fields
      if (
        fieldDef.type === "value-type" &&
        fieldDef.supportedTypes?.includes("json") &&
        typeof value === "string"
      ) {
        try {
          return JSON.parse(value);
        } catch {
          return value; // Keep as string if parsing fails
        }
      }

      // Handle boolean fields (ensure they're actual booleans)
      if (fieldDef.type === "checkbox" || fieldDef.type === "switch") {
        return Boolean(value);
      }

      return value;
    },
    []
  );

  // Helper function to sanitize form values
  const sanitizeFormValues = useCallback(
    (values: TFieldValues) => {
      return Object.entries(values).reduce(
        (acc, [key, value]) => {
          // Find the field definition to check its type
          const fieldDef = config?.fields?.find(
            (f: AnyFieldDefinition<TFieldValues>) => f.name === key
          );

          acc[key] = sanitizeFieldValue(key, value, fieldDef);
          return acc;
        },
        {} as Record<string, unknown>
      );
    },
    [config?.fields, sanitizeFieldValue]
  );

  // Helper function to prepare update data
  const prepareUpdateData = useCallback(
    (
      sanitizedValues: Record<string, unknown>,
      operationMode: "create" | "update",
      initialFormData?: Partial<TFieldValues>
    ) => {
      let dataToSubmit = sanitizedValues;
      if (operationMode === "update" && initialFormData) {
        // Merge the sanitized form values with the initial data
        dataToSubmit = {
          ...(initialFormData as Record<string, unknown>),
          ...sanitizedValues,
        };

        // Remove null JSON fields entirely - this prevents validation errors
        // and lets Prisma handle the fields appropriately
        for (const key of Object.keys(dataToSubmit)) {
          if (
            dataToSubmit[key] === null &&
            (key === "options" ||
              key === "value" ||
              key === "config" ||
              key === "metadata")
          ) {
            // For JSON fields, omit them entirely if they're null
            delete dataToSubmit[key];
          }
        }
      }
      return dataToSubmit;
    },
    []
  );

  // Helper function to execute form action
  const executeFormAction = useCallback(
    async (
      operationMode: "create" | "update",
      tableActions: {
        create?: (data: Record<string, unknown>) => Promise<{
          success: boolean;
          data?: unknown;
          error?: string | undefined;
        }>;
        update?: (
          id: string,
          data: Record<string, unknown>
        ) => Promise<{
          success: boolean;
          data?: unknown;
          error?: string | undefined;
        }>;
      },
      formValues: TFieldValues,
      initialFormData: Partial<TFieldValues> | undefined,
      formTypeName: string,
      dataToSubmit: Record<string, unknown>,
      sanitizedValues: Record<string, unknown>
    ) => {
      if (operationMode === "update" && tableActions.update) {
        // For update, we need the ID from the values or initialData
        let id: string;

        // Try to get ID from values first
        if ("id" in formValues) {
          id = String(formValues.id);
        }
        // Then try to get ID from initialData if available
        else if (initialFormData && "id" in initialFormData) {
          id = String((initialFormData as Record<string, unknown>).id);
        }
        // If no ID is found, throw an error
        else {
          throw new Error(
            `ID not found for update operation on ${formTypeName}`
          );
        }

        // Create a clean copy of the data without the ID for the update operation
        const updateData = { ...dataToSubmit };
        if ("id" in updateData) {
          (updateData as Record<string, unknown>).id = undefined;
        }

        return await tableActions.update(
          id as string,
          updateData as Record<string, unknown>
        );
      }
      if (operationMode === "create" && tableActions.create) {
        return await tableActions.create(
          sanitizedValues as Record<string, unknown>
        );
      }
      throw new Error(
        `Action ${operationMode} not available for ${formTypeName}`
      );
    },
    []
  );

  // Handle form submission (passed to useFormBuilder as onSubmit)
  const handleSubmit = useCallback(
    async (values: TFieldValues) => {
      const sanitizedValues = sanitizeFormValues(values);
      const dataToSubmit = prepareUpdateData(
        sanitizedValues,
        mode,
        initialData
      );
      const result = await executeFormAction(
        mode,
        actions,
        values,
        initialData,
        formType,
        dataToSubmit,
        sanitizedValues
      );
      if (!result.success) {
        throw new Error(result.error ?? `Failed to ${mode} ${formType}`);
      }
      return result.data;
    },
    [
      formType,
      mode,
      actions,
      initialData,
      executeFormAction,
      sanitizeFormValues,
      prepareUpdateData,
    ]
  );

  const { fields, form, sections, translations } = useFormBuilder<TFieldValues>(
    {
      config,
      formOptions: {
        onSubmit: onFormSubmit
          ? (values) => {
              onFormSubmit(values, handleSubmit);
            }
          : (values) => {
              handleSubmit(values);
            },
      },
      initialData,
      onValuesChange: handleValuesChange,
    }
  );

  return {
    fields,
    form,
    handleSubmit,
    sections,
    translations,
  };
}
