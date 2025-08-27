/**
 * Hook for managing bulk edit operations
 */
'use client';

import { useQueryClient } from '@tanstack/react-query';
import type { Row } from '@tanstack/react-table';
import { useAtom } from 'jotai';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  type CatalogueFormState,
  catalogueFormAtom,
  openUpdateForm,
} from '../components/forms/atoms/catalogue-form-atoms';

/**
 * Configuration for bulk edit
 */
interface BulkEditConfig<TData> {
  /**
   * Table ID for form configuration
   */
  tableId: string;

  /**
   * Form type for bulk edit (defaults to tableId + '-bulk')
   */
  formType?: string;

  /**
   * Custom success handler
   */
  onSuccess?: (updatedData: Partial<TData>, selectedRows: Row<TData>[]) => void;

  /**
   * Custom API update function
   */
  onUpdate?: (ids: string[], data: Partial<TData>) => Promise<boolean>;
}

/**
 * Return type for the bulk edit hook
 */
interface BulkEditReturn<TData> {
  /**
   * Open bulk edit form for selected rows
   */
  openBulkEdit: (selectedRows: Row<TData>[]) => void;

  /**
   * Whether bulk edit form is currently open
   */
  isBulkEditOpen: boolean;

  /**
   * Close bulk edit form
   */
  closeBulkEdit: () => void;
}

/**
 * Hook to manage bulk edit operations
 *
 * Provides functionality to open a bulk edit form for multiple selected rows
 * and handle the update operation
 */
export function useBulkEdit<TData extends Record<string, unknown>>({
  tableId,
  formType,
  onSuccess,
  onUpdate,
}: BulkEditConfig<TData>): BulkEditReturn<TData> {
  const [formState, setFormState] = useAtom(catalogueFormAtom);
  const queryClient = useQueryClient();

  // Determine the form type for bulk edit
  const bulkFormType = formType || `${tableId}-bulk`;

  // Check if bulk edit form is open
  const isBulkEditOpen = useMemo(() => {
    return (
      formState.isOpen &&
      formState.formType === bulkFormType &&
      formState.mode === 'update'
    );
  }, [formState, bulkFormType]);

  // Extract common values from selected rows for initial form data
  const extractCommonValues = useCallback(
    (selectedRows: Row<TData>[]): Record<string, unknown> => {
      if (selectedRows.length === 0) {
        return {};
      }

      const firstRow = selectedRows[0].original;
      const commonData: Record<string, unknown> = {};

      // Find fields that have the same value across all selected rows
      for (const key in firstRow) {
        if (Object.hasOwn(firstRow, key)) {
          const firstValue = firstRow[key];
          const allSameValue = selectedRows.every(
            (row) => row.original[key] === firstValue
          );

          if (allSameValue) {
            commonData[key] = firstValue;
          }
        }
      }

      return commonData as Partial<TData>;
    },
    []
  );

  // Helper function to extract IDs from rows
  const extractRowIds = useCallback((selectedRows: Row<TData>[]): string[] => {
    return selectedRows
      .map((row) => {
        // Try to get ID from different possible fields
        const rowData = row.original;
        return rowData.id || rowData._id || row.id;
      })
      .filter(Boolean) as string[];
  }, []);

  // Helper function to clean form data
  const cleanFormData = useCallback(
    (formData: Partial<TData>): Partial<TData> => {
      const cleanData: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(formData)) {
        if (value !== undefined && value !== '') {
          cleanData[key] = value;
        }
      }

      return cleanData as Partial<TData>;
    },
    []
  );

  // Helper function to perform the update
  const performUpdate = useCallback(
    async (ids: string[], cleanData: Partial<TData>): Promise<boolean> => {
      if (onUpdate) {
        return await onUpdate(ids, cleanData);
      }

      // Use default update logic
      console.log('Bulk updating items:', { ids, data: cleanData });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return true;
    },
    [onUpdate]
  );

  // Handle bulk update submission
  const handleBulkUpdate = useCallback(
    async (
      formData: Partial<TData>,
      selectedRows: Row<TData>[]
    ): Promise<boolean> => {
      try {
        const ids = extractRowIds(selectedRows);

        if (ids.length === 0) {
          toast.error('No valid IDs found for update');
          return false;
        }

        const cleanData = cleanFormData(formData);

        if (Object.keys(cleanData).length === 0) {
          toast.error('No changes to apply');
          return false;
        }

        const success = await performUpdate(ids, cleanData);

        if (success) {
          // Invalidate queries to refresh data
          await queryClient.invalidateQueries({
            queryKey: ['tableData', tableId],
          });

          // Call custom success handler
          if (onSuccess) {
            onSuccess(cleanData, selectedRows);
          }

          toast.success(
            `Successfully updated ${ids.length} item${ids.length > 1 ? 's' : ''}`
          );
          return true;
        }

        toast.error('Failed to update items');
        return false;
      } catch (error) {
        console.error('Bulk update error:', error);
        toast.error('Failed to update items');
        return false;
      }
    },
    [
      extractRowIds,
      cleanFormData,
      performUpdate,
      queryClient,
      tableId,
      onSuccess,
    ]
  );

  // Open bulk edit form
  const openBulkEdit = useCallback(
    (selectedRows: Row<TData>[]) => {
      if (selectedRows.length === 0) {
        toast.error('No rows selected');
        return;
      }

      // Extract common values for initial form data
      const commonValues = extractCommonValues(selectedRows);

      // Create initial data with metadata about the bulk operation
      const initialData = {
        ...commonValues,
        _bulkEdit: {
          selectedCount: selectedRows.length,
          selectedIds: selectedRows.map((row) => row.id),
          selectedRows: selectedRows.map((row) => row.original),
        },
      } as Partial<TData> & {
        _bulkEdit: {
          selectedCount: number;
          selectedIds: string[];
          selectedRows: TData[];
        };
      };

      // Create success handler that includes the selected rows
      const handleSuccess = (data: Partial<TData>) => {
        return handleBulkUpdate(data, selectedRows);
      };

      // Create form state for bulk edit
      const newFormState = openUpdateForm(
        bulkFormType,
        tableId,
        initialData,
        handleSuccess
      );

      // Set the form state
      setFormState(
        newFormState as unknown as CatalogueFormState<Record<string, unknown>>
      );
    },
    [bulkFormType, tableId, extractCommonValues, handleBulkUpdate, setFormState]
  );

  // Close bulk edit form
  const closeBulkEdit = useCallback(() => {
    if (isBulkEditOpen) {
      setFormState((prev) => ({
        ...prev,
        isOpen: false,
      }));
    }
  }, [isBulkEditOpen, setFormState]);

  return {
    openBulkEdit,
    isBulkEditOpen,
    closeBulkEdit,
  };
}

/**
 * Helper function to create a permissive Zod schema for bulk edit
 */
function createBulkEditSchema(
  fields: Record<string, unknown>[]
): z.ZodObject<Record<string, z.ZodOptional<z.ZodAny>>> {
  const schemaShape: Record<string, z.ZodOptional<z.ZodAny>> = {};

  for (const field of fields) {
    const fieldName = field.name as string;
    const fieldType = field.type as string;

    // Create optional schema for each field type - all as ZodAny to simplify
    switch (fieldType) {
      case 'number':
        schemaShape[fieldName] = z.any().optional();
        break;
      case 'boolean':
      case 'checkbox':
        schemaShape[fieldName] = z.any().optional();
        break;
      default:
        schemaShape[fieldName] = z.any().optional();
        break;
    }
  }

  return z.object(schemaShape);
}

/**
 * Helper function to create bulk edit form configuration
 */
export function createBulkEditFormConfig(
  baseConfig: Record<string, unknown>,
  options: {
    title?: string;
    description?: string;
    excludeFields?: string[];
    includeFields?: string[];
    uniqueFields?: string[]; // Fields that must remain unique and shouldn't be bulk edited
  } = {}
) {
  const {
    title = 'Bulk Edit',
    description = 'Edit multiple items at once. Only filled fields will be applied to all selected items. Leave fields empty to keep their current values.',
    excludeFields = ['id', '_id', 'createdAt', 'updatedAt'],
    includeFields,
    uniqueFields = ['email', 'username', 'sku', 'slug', 'code'], // Common unique fields
  } = options;

  // Filter fields for bulk edit
  let fields = (baseConfig.fields as Record<string, unknown>[]) || [];

  // Combine all fields to exclude (standard excludes + unique fields)
  const allExcludeFields = [...excludeFields, ...uniqueFields];

  if (includeFields) {
    fields = fields.filter((field: Record<string, unknown>) =>
      includeFields.includes(field.name as string)
    );
  } else {
    fields = fields.filter(
      (field: Record<string, unknown>) =>
        !allExcludeFields.includes(field.name as string)
    );
  }

  // Make all fields optional for bulk edit with clear placeholders
  fields = fields.map((field: Record<string, unknown>) => ({
    ...field,
    required: false, // Force all fields to be optional
    placeholder: field.placeholder || 'Leave empty to keep current value',
    description: field.description || undefined, // Remove field-level description
    validation: undefined, // Remove field-level validation rules
  }));

  const baseTranslations = baseConfig.translations as
    | { keys?: Record<string, string> }
    | undefined;

  // Create a permissive schema for bulk edit
  const bulkEditSchema = createBulkEditSchema(fields);

  return {
    ...baseConfig,
    id: `${baseConfig.id}-bulk`,
    fields,
    schema: bulkEditSchema, // Use permissive schema that makes all fields optional
    defaultValues: {}, // Clear default values - bulk edit should start empty
    translations: {
      ...baseTranslations,
      keys: {
        ...(baseTranslations?.keys || {}),
        'updateForm.title': title,
        'updateForm.description': description,
        update: 'Update Selected Items',
        updating: 'Updating items...',
        success: 'Items updated successfully',
        error: 'Failed to update items',
      },
    },
  };
}
