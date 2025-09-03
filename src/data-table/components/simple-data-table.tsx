/**
 * API ultra-simple pour créer une table complète
 * Un seul composant avec config unifiée
 */
'use client';

import { Suspense } from 'react';
import { useDataTable } from '../hooks/use-data-table';
import { DataTableUIProvider } from '../providers/data-table-ui-provider';
import {
  defaultTranslations,
  TableProvider,
} from '../providers/table-provider';
import { DataTableSkeleton } from './data-table-skeleton';
import { DataTable as ModernDataTable } from './modern-data-table';

// Interface étendue qui inclut les colonnes
interface ExtendedDataTableConfig {
  columns?: {
    order?: string[];
    visible?: string[];
    mandatory?: string[];
    definitions?: Array<{
      id: string;
      type: string;
      header: string;
      enableSorting?: boolean;
      enableColumnFilter?: boolean;
      enableGrouping?: boolean;
    }>;
  };
  defaultPageSize: number;
  enableColumnDragDropByDefault: boolean;
  enableColumnFilters: boolean;
  enableMultiRowSelection: boolean;
  enablePagination: boolean;
  enableRowDragDrop: boolean;
  enableRowSelection: boolean;
  enableSorting: boolean;
  enableGrouping?: boolean;
  manualFiltering: boolean;
  manualPagination: boolean;
  manualSorting: boolean;
  pageSizeOptions: number[];
}

// Type pour la config unifiée
interface SimpleTableConfig {
  // Métadonnées
  id: string;
  name: string;
  description?: string;

  // Configuration du comportement
  table: {
    defaultPageSize?: number;
    enableColumnFilters?: boolean;
    enableGrouping?: boolean;
    enableMultiRowSelection?: boolean;
    enablePagination?: boolean;
    enableRowSelection?: boolean;
    enableSorting?: boolean;
    manualFiltering?: boolean;
    manualPagination?: boolean;
    manualSorting?: boolean;
    pageSizeOptions?: number[];
  };

  // Colonnes avec types
  columns: Array<{
    id: string;
    type: 'text' | 'tag' | 'number' | 'boolean' | 'date';
    header: string;
    enableSorting?: boolean;
    enableColumnFilter?: boolean;
    enableGrouping?: boolean;
  }>;

  // Actions serveur
  actions: {
    list: (params: Record<string, unknown>) => Promise<{
      data: Record<string, unknown>[];
      meta?: {
        pageCount?: number;
        totalCount?: number;
      };
    }>;
    create?: (
      data: Record<string, unknown>
    ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    update?: (
      id: string,
      data: Record<string, unknown>
    ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    delete?: (
      id: string
    ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
    duplicate?: (
      id: string
    ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  };

  // Configuration des colonnes par défaut
  defaultColumns: {
    order: string[];
    visible: string[];
    mandatory: string[];
  };

  // Mapping des types pour les filtres avancés
  columnTypeMapping?: Record<
    string,
    'text' | 'number' | 'date' | 'option' | 'multiOption'
  >;
}

interface SimpleDataTableProps {
  config: SimpleTableConfig;
  enableAdvancedFilters?: boolean;
  className?: string;
  onRowSelectionChange?: (rows: unknown[]) => void;
  onBulkEdit?: (rows: unknown[]) => void;
  onBulkDelete?: (rows: unknown[]) => void;
  onBulkCopy?: (rows: unknown[]) => void;
}

/**
 * Composant DataTable ultra-simple
 * Usage: <SimpleDataTable config={myConfig} />
 */
export const SimpleDataTable = ({
  config,
  enableAdvancedFilters = false,
  className,
  onRowSelectionChange,
  onBulkEdit,
  onBulkDelete,
  onBulkCopy,
}: SimpleDataTableProps) => {
  // Créer les fonctions de helper pour le provider
  const getTableConfig = (
    tableType: string
  ): ExtendedDataTableConfig | undefined => {
    if (tableType !== config.id) {
      return;
    }

    return {
      defaultPageSize: config.table.defaultPageSize || 10,
      enableColumnDragDropByDefault: false,
      enableColumnFilters: config.table.enableColumnFilters ?? true,
      enableMultiRowSelection: config.table.enableMultiRowSelection ?? true,
      enablePagination: config.table.enablePagination ?? true,
      enableRowDragDrop: false,
      enableRowSelection: config.table.enableRowSelection ?? true,
      enableSorting: config.table.enableSorting ?? true,
      enableGrouping: config.table.enableGrouping ?? true,
      manualFiltering: config.table.manualFiltering ?? true,
      manualPagination: config.table.manualPagination ?? true,
      manualSorting: config.table.manualSorting ?? true,
      pageSizeOptions: config.table.pageSizeOptions || [5, 10, 20, 50],
      columns: {
        order: config.defaultColumns.order,
        visible: config.defaultColumns.visible,
        mandatory: config.defaultColumns.mandatory,
        definitions: config.columns,
      },
    };
  };

  const getTableActions = (tableType: string) => {
    if (tableType !== config.id) {
      return;
    }
    return config.actions;
  };

  return (
    <TableProvider
      columnsConfig={{
        defaultColumnOrder: config.defaultColumns.order,
        defaultVisibleColumns: config.defaultColumns.visible,
        mandatoryColumns: config.defaultColumns.mandatory,
      }}
      getTableActions={getTableActions}
      getTableConfig={getTableConfig}
      locale="en"
      tableConfig={{
        defaultPageSize: config.table.defaultPageSize || 10,
        enableColumnFilters: config.table.enableColumnFilters ?? true,
        enableGrouping: config.table.enableGrouping ?? true,
        enableMultiRowSelection: config.table.enableMultiRowSelection ?? true,
        enablePagination: config.table.enablePagination ?? true,
        enableRowSelection: config.table.enableRowSelection ?? true,
        enableSorting: config.table.enableSorting ?? true,
        manualFiltering: config.table.manualFiltering ?? true,
        manualPagination: config.table.manualPagination ?? true,
        manualSorting: config.table.manualSorting ?? true,
        pageSizeOptions: config.table.pageSizeOptions || [5, 10, 20, 50],
      }}
      tableId={config.id}
      translations={defaultTranslations}
    >
      <SimpleDataTableInner
        className={className}
        config={config}
        enableAdvancedFilters={enableAdvancedFilters}
        onBulkCopy={onBulkCopy}
        onBulkDelete={onBulkDelete}
        onBulkEdit={onBulkEdit}
        onRowSelectionChange={onRowSelectionChange}
      />
    </TableProvider>
  );
};

// Helper pour créer la config des colonnes
const createColumnsConfig = (config: SimpleTableConfig) => ({
  defaultColumnOrder: config.defaultColumns.order,
  defaultVisibleColumns: config.defaultColumns.visible,
  mandatoryColumns: config.defaultColumns.mandatory,
});

// Helper pour créer la config de la table
const createTableConfig = (config: SimpleTableConfig) => ({
  defaultPageSize: config.table.defaultPageSize || 10,
  enableColumnFilters: config.table.enableColumnFilters ?? true,
  enableGrouping: config.table.enableGrouping ?? true,
  enableMultiRowSelection: config.table.enableMultiRowSelection ?? true,
  enablePagination: config.table.enablePagination ?? true,
  enableRowSelection: config.table.enableRowSelection ?? true,
  enableSorting: config.table.enableSorting ?? true,
  manualFiltering: config.table.manualFiltering ?? true,
  manualPagination: config.table.manualPagination ?? true,
  manualSorting: config.table.manualSorting ?? true,
  pageSizeOptions: config.table.pageSizeOptions || [5, 10, 20, 50],
});

// Composant header simplifié
const TableHeader = ({ config }: { config: SimpleTableConfig }) => (
  <div className="space-y-1">
    <h2 className="font-semibold text-foreground text-xl">{config.name}</h2>
    {config.description && (
      <p className="text-muted-foreground text-sm">{config.description}</p>
    )}
  </div>
);

// Composant interne qui utilise les hooks
const SimpleDataTableInner = (props: SimpleDataTableProps) => {
  const { config } = props;

  const { columns, data, isLoading, pageCount, refetch, rowCount } =
    useDataTable({
      tableId: config.id,
      tableType: config.id,
    });

  if (isLoading) {
    return <DataTableSkeleton />;
  }

  const columnsConfig = createColumnsConfig(config);
  const tableConfig = createTableConfig(config);

  return (
    <DataTableUIProvider
      columnsConfig={columnsConfig}
      tableConfig={tableConfig}
      tableId={config.id}
      translations={defaultTranslations as any}
    >
      <div className="space-y-4">
        <TableHeader config={config} />
        <TableContent
          {...props}
          columns={columns}
          data={data}
          pageCount={pageCount}
          refetch={refetch}
          rowCount={rowCount}
        />
      </div>
    </DataTableUIProvider>
  );
};

// Composant pour le contenu de la table
const TableContent = ({
  config,
  className,
  onRowSelectionChange,
  onBulkEdit,
  onBulkDelete,
  onBulkCopy,
  columns,
  data,
  pageCount,
  refetch,
  rowCount,
}: SimpleDataTableProps & {
  columns: unknown;
  data: Record<string, unknown>[];
  pageCount: number;
  refetch: () => void;
  rowCount: number;
}) => {
  const tableConfig = createTableConfig(config);

  return (
    <Suspense fallback={<DataTableSkeleton />}>
      <ModernDataTable
        className={className}
        columns={
          columns as import('@tanstack/react-table').ColumnDef<
            Record<string, unknown>
          >[]
        }
        data={data || []}
        enableColumnFilters={tableConfig.enableColumnFilters}
        enableGrouping={tableConfig.enableGrouping}
        enableMultiRowSelection={tableConfig.enableMultiRowSelection}
        enablePagination={tableConfig.enablePagination}
        enableRowSelection={tableConfig.enableRowSelection}
        enableSorting={tableConfig.enableSorting}
        manualFiltering={tableConfig.manualFiltering}
        manualPagination={tableConfig.manualPagination}
        manualSorting={tableConfig.manualSorting}
        onBulkCopy={onBulkCopy}
        onBulkDelete={onBulkDelete}
        onBulkEdit={onBulkEdit}
        onRowSelectionChange={onRowSelectionChange}
        queryFn={async (_params) => {
          await refetch();
          return {
            data: (data || []) as Record<string, unknown>[],
            pageCount: pageCount || 1,
            rowCount: rowCount || 0,
          };
        }}
        tableId={config.id}
        tableType={config.id}
      />
    </Suspense>
  );
};

export type { SimpleTableConfig };
