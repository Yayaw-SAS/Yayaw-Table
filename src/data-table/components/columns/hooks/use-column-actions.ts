/**
 * Hook for managing column actions
 * Provides utilities for column visibility, ordering, and other UI actions
 * Uses URL state for shareable states (order, visibility) and atoms for local states (translations, definitions)
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import type { AccessorFn, ColumnDef, ColumnMeta } from '@tanstack/react-table';
import { useAtom } from 'jotai';
import { useCallback, useMemo, useRef } from 'react';
import type { DataTableColumnDef } from '../../../../types/column-types';
import {
  cleanColumnId,
  columnIdMappingAtom,
} from '../../../atoms/filter-atoms';
import {
  columnsAtom,
  columnTranslationsAtom,
} from '../../../atoms/table-atoms';
import { useTableUrlState } from '../../../hooks/use-table-url-state';

interface UseColumnActionsOptions<
  TData extends Record<string, unknown> = Record<string, unknown>,
> {
  columns?: Array<ColumnDef<TData> | DataTableColumnDef<TData>>;
  tableId: string;
}

/**
 * Hook for managing column actions like visibility, ordering, etc.
 * @param options - Configuration options
 * @returns Object with column action utilities
 */
export function useColumnActions<
  TData extends Record<string, unknown> = Record<string, unknown>,
>({ columns: externalColumns, tableId }: UseColumnActionsOptions<TData>) {
  // Use refs to prevent infinite loops
  const initialized = useRef(false);
  const processingColumns = useRef(false);

  // **URL STATE** - for shareable states (order, visibility)
  const { orderParam, setOrderFromUI, visibilityParam, setVisibilityFromUI } =
    useTableUrlState({
      tableId,
    });

  // **ATOMS** - only for local states (translations, definitions)
  const [columns, setColumns] = useAtom(columnsAtom(tableId));
  const [columnTranslations, setColumnTranslations] = useAtom(
    columnTranslationsAtom(tableId)
  );
  const [columnIdMapping, _setColumnIdMapping] = useAtom(
    columnIdMappingAtom(tableId)
  );

  // Get current state from URL state
  const columnOrder = (orderParam as string[]) || [];
  const columnVisibility = (visibilityParam as Record<string, boolean>) || {};

  // Using cleanColumnId from filter-atoms.ts

  // Get a consistent column ID
  const getColumnId = useCallback(
    (
      column:
        | ColumnDef<TData>
        | DataTableColumnDef<TData>
        | DataTableColumnDef<Record<string, unknown>>,
      index?: number
    ): string => {
      // Use id if it's a string
      if (typeof column.id === 'string') {
        // Check mapping first
        if (columnIdMapping.has(column.id)) {
          return columnIdMapping.get(column.id) || column.id;
        }

        // Clean Turbopack references
        if (column.id.includes('__TURBOPACK__')) {
          return cleanColumnId(column.id);
        }

        return column.id;
      }

      // Try accessorKey
      const accessorKey =
        (column as DataTableColumnDef<TData>).accessorKey ||
        (column as ColumnDef<TData> & { accessorKey?: string }).accessorKey;
      if (accessorKey !== undefined) {
        return String(accessorKey);
      }

      // Try header
      if (typeof column.header === 'string') {
        return `col-${column.header.toLowerCase().replace(/\s+/g, '-')}`;
      }

      // Fallback to index
      return `col-${tableId}-${index || 0}`;
    },
    [tableId, columnIdMapping]
  );

  // Use a stable reference for the query function to prevent unnecessary re-renders
  // This function will only run once when the component mounts
  const processColumnsFn = useCallback(() => {
    // Double-check to prevent multiple executions
    if (
      !externalColumns?.length ||
      initialized.current ||
      processingColumns.current
    ) {
      return null;
    }

    // Set processing flag to prevent concurrent executions
    processingColumns.current = true;

    // Process external columns

    // Helper function to get column ID
    const getColumnIdFromDef = (
      columnDef: ColumnDef<TData>,
      index: number
    ): string => {
      if (columnDef.id) {
        return columnDef.id;
      }

      const columnWithAccessor = columnDef as ColumnDef<TData> & {
        accessorKey?: string;
      };
      if (columnWithAccessor.accessorKey) {
        return String(columnWithAccessor.accessorKey);
      }

      return getColumnId(columnDef, index);
    };

    // Helper function to get header text
    const getHeaderText = (columnDef: ColumnDef<TData>): string => {
      if (typeof columnDef.header === 'string') {
        return columnDef.header;
      }

      const columnWithAccessor = columnDef as ColumnDef<TData> & {
        accessorKey?: string;
      };
      if (columnWithAccessor.accessorKey) {
        const accessorKey = String(columnWithAccessor.accessorKey);
        return (
          accessorKey.charAt(0).toUpperCase() +
          accessorKey
            .slice(1)
            .replace(/([A-Z])/g, ' $1')
            .trim()
        );
      }

      return '';
    };

    // Helper function to process single column
    const processColumn = (
      col: ColumnDef<TData> | DataTableColumnDef<TData>,
      index: number
    ): DataTableColumnDef<TData> => {
      // Already a DataTableColumnDef
      if ((col as DataTableColumnDef<TData>).type !== undefined) {
        return col as DataTableColumnDef<TData>;
      }

      const columnDef = col as ColumnDef<TData>;
      const id = getColumnIdFromDef(columnDef, index);
      let headerText = getHeaderText(columnDef);

      // If no header text found, use ID as fallback
      if (!headerText) {
        headerText =
          id.charAt(0).toUpperCase() +
          id
            .slice(1)
            .replace(/([A-Z])/g, ' $1')
            .trim();
      }

      const columnWithAccessor = columnDef as ColumnDef<TData> & {
        accessorKey?: string;
      };

      return {
        accessorFn: (
          columnDef as ColumnDef<TData> & {
            accessorFn?: (row: TData) => unknown;
          }
        ).accessorFn,
        accessorKey: columnWithAccessor.accessorKey,
        cell: columnDef.cell,
        enableFiltering: columnDef.enableColumnFilter,
        enableHiding: columnDef.enableHiding,
        enableResizing: columnDef.enableResizing,
        enableSorting: columnDef.enableSorting,
        header: headerText,
        id,
        meta: columnDef.meta,
        type: 'text',
      } as DataTableColumnDef<TData>;
    };

    // Convert columns to DataTableColumnDef format
    const processedColumns = externalColumns.map(processColumn);

    // Create ID mappings
    const idMappings: Record<string, string> = {};
    const translations: Record<string, string> = {};

    for (const col of processedColumns) {
      // Preserve original column ID when possible
      const id = col.id || getColumnId(col, 0);
      idMappings[col.id] = id;
      translations[id] = col.header;
    }

    // Update atoms
    setColumns(
      processedColumns as DataTableColumnDef<Record<string, unknown>>[]
    );
    // Note: We can't update columnIdMapping directly as it's a derived atom in filter-atoms.ts
    // The mapping will be updated automatically when filters change
    setColumnTranslations((prev) => ({ ...prev, ...translations }));

    // Set initialization flag to prevent future executions
    initialized.current = true;
    // Reset processing flag
    processingColumns.current = false;
    return processedColumns;
  }, [externalColumns, getColumnId, setColumnTranslations, setColumns]);

  // Stabilize the external columns reference to prevent unnecessary query reruns
  const columnsLength = externalColumns?.length || 0;

  // Use a stable reference for the query key that only depends on tableId and columns length
  const queryKey = useMemo(
    () => ['table-columns', tableId, columnsLength],
    [tableId, columnsLength]
  );

  // Execute the query with stable references to prevent unnecessary re-renders
  // Properties ordered alphabetically to satisfy ESLint
  // The query will only run once when the component mounts and the conditions are met
  useQuery({
    enabled:
      !!columnsLength && !initialized.current && !processingColumns.current,
    gcTime: Number.POSITIVE_INFINITY, // Never garbage collect
    queryFn: processColumnsFn,
    queryKey,
    staleTime: Number.POSITIVE_INFINITY, // Never refetch automatically
  });

  // Extract column IDs
  const columnIds = useMemo(() => {
    return columns.map((col, idx) => getColumnId(col, idx));
  }, [columns, getColumnId]);

  // Initialize column order if not set
  const initialColumnOrder = useMemo(() => {
    return columnOrder.length > 0 ? columnOrder : columnIds;
  }, [columnIds, columnOrder]);

  // Get visible and hidden columns
  const { hiddenColumns, visibleColumns } = useMemo(() => {
    const visible = columns.filter((col) => {
      const id = getColumnId(col);
      return columnVisibility[id] !== false;
    });

    const hidden = columns.filter((col) => {
      const id = getColumnId(col);
      return columnVisibility[id] === false;
    });

    return { hiddenColumns: hidden, visibleColumns: visible };
  }, [columns, columnVisibility, getColumnId]);

  // Column visibility actions
  const toggleColumnVisibility = useCallback(
    (columnId: string) => {
      const newVisibility = {
        ...columnVisibility,
        [columnId]: !columnVisibility[columnId],
      };
      setVisibilityFromUI(newVisibility);
    },
    [columnVisibility, setVisibilityFromUI]
  );

  const resetColumnVisibility = useCallback(() => {
    setVisibilityFromUI({});
  }, [setVisibilityFromUI]);

  const hideAllColumns = useCallback(() => {
    const newVisibility: Record<string, boolean> = {};
    for (const id of columnIds) {
      newVisibility[id] = false;
    }
    setVisibilityFromUI(newVisibility);
  }, [columnIds, setVisibilityFromUI]);

  const showAllColumns = useCallback(() => {
    const newVisibility: Record<string, boolean> = {};
    for (const id of columnIds) {
      newVisibility[id] = true;
    }
    setVisibilityFromUI(newVisibility);
  }, [columnIds, setVisibilityFromUI]);

  // Column order actions
  const resetColumnOrder = useCallback(() => {
    setOrderFromUI(columnIds);
  }, [columnIds, setOrderFromUI]);

  const moveColumn = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newOrder = [...columnOrder];
      const item = newOrder.splice(fromIndex, 1)[0];
      newOrder.splice(toIndex, 0, item);
      setOrderFromUI(newOrder);
    },
    [columnOrder, setOrderFromUI]
  );

  // Convert to TanStack Table column definitions
  const tanStackColumns = useMemo<ColumnDef<TData>[]>(() => {
    return columns.map((col) => {
      // Create a properly typed column definition
      const columnDef: ColumnDef<TData> = {
        accessorFn: col.accessorFn as AccessorFn<TData, unknown>,
        accessorKey: col.accessorKey as keyof TData,
        cell: col.cell as ColumnDef<TData>['cell'],
        enableColumnFilter:
          col.enableFiltering !== undefined ? col.enableFiltering : true,
        enableHiding: col.enableHiding,
        enableResizing: col.enableResizing,
        enableSorting: col.enableSorting,
        header: columnTranslations[col.id] || col.header,
        id: col.id,
        meta: col.meta as ColumnMeta<TData, unknown>,
      };

      return columnDef;
    });
  }, [columns, columnTranslations]);

  // Get column name by ID
  const getColumnName = useCallback(
    (columnId: string) => {
      const cleanedId = columnId.includes('__TURBOPACK__')
        ? cleanColumnId(columnId)
        : columnId;

      // Try translations
      if (columnTranslations[cleanedId]) {
        return columnTranslations[cleanedId];
      }

      // Try ID mapping
      const mappedId = columnIdMapping.get(columnId);
      if (mappedId && columnTranslations[mappedId]) {
        return columnTranslations[mappedId];
      }

      // Try case-insensitive match
      const similarKey = Object.keys(columnTranslations).find(
        (key) => key.toLowerCase() === cleanedId.toLowerCase()
      );

      if (similarKey) {
        return columnTranslations[similarKey];
      }

      // Fallback to formatted ID
      return (
        cleanedId.charAt(0).toUpperCase() +
        cleanedId
          .slice(1)
          .replace(/([A-Z])/g, ' $1')
          .trim()
      );
    },
    [columnTranslations, columnIdMapping]
  );

  return {
    cleanColumnId,
    columnIds,
    columnOrder: columnOrder.length ? columnOrder : initialColumnOrder,
    columns,
    columnTranslations,
    columnVisibility,
    getColumnId,
    getColumnName,
    hiddenColumns,
    hideAllColumns,
    moveColumn,
    resetColumnOrder,
    resetColumnVisibility,
    setOrderFromUI,
    setVisibilityFromUI,
    showAllColumns,
    tanStackColumns,
    toggleColumnVisibility,
    visibleColumns,
  };
}
