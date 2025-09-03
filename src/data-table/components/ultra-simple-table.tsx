/**
 * Table ultra-simple sans dépendances aux anciens hooks
 * Utilise directement les actions et évite les boucles infinies
 */
'use client';

import {
  type ColumnDef,
  createColumnHelper,
  type ExpandedState,
  flexRender,
  type GroupingState,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { ColumnIcon } from '../utils/column-icons';
import { SafePagination } from './safe-pagination';

// Type pour la config ultra-simple
interface UltraSimpleConfig {
  id: string;
  name: string;
  description?: string;

  columns: Array<{
    id: string;
    type: 'text' | 'tag' | 'number' | 'boolean' | 'date';
    header: string;
  }>;

  fetchData: (params: {
    page: number;
    pageSize: number;
    sorting: SortingState;
    grouping: GroupingState;
  }) => Promise<{
    data: Record<string, unknown>[];
    pageCount: number;
    totalCount: number;
  }>;
}

interface UltraSimpleTableProps {
  config: UltraSimpleConfig;
}

export const UltraSimpleTable = ({ config }: UltraSimpleTableProps) => {
  // État local simple
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [grouping, setGrouping] = useState<GroupingState>([]);
  const [pageCount, setPageCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // Créer les colonnes dynamiquement
  const columnHelper = createColumnHelper<Record<string, unknown>>();

  const columns: ColumnDef<Record<string, unknown>>[] = config.columns.map(
    (col) =>
      columnHelper.accessor(col.id, {
        header: col.header,
        enableGrouping: true,
        cell: ({ getValue, row }) => {
          const value = getValue();

          // Si c'est une ligne groupée, afficher le contrôle d'expansion
          if (row.getIsGrouped()) {
            const groupValue = String(value || 'Unknown');
            const isExpanded = row.getIsExpanded();
            const subRowsCount = row.subRows.length;

            return (
              <div className="flex items-center gap-2">
                <Button
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded((prev) => {
                      const currentExpanded =
                        typeof prev === 'object' ? prev : {};
                      const newExpanded = { ...currentExpanded } as Record<
                        string,
                        boolean
                      >;
                      newExpanded[row.id] = !newExpanded[row.id];
                      return newExpanded;
                    });
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
                <ColumnIcon className="h-4 w-4" columnType={col.type} />
                <span className="font-medium">{groupValue}</span>
                <span className="text-muted-foreground text-sm">
                  ({subRowsCount})
                </span>
              </div>
            );
          }

          // Cellule normale
          return <span>{String(value || '')}</span>;
        },
      })
  );

  // Fonction de fetch des données
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await config.fetchData({
        page: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        grouping,
      });

      setData(result.data);
      setPageCount(result.pageCount);
      setTotalCount(result.totalCount);
    } catch (error) {
      console.error('Error fetching data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [config, pagination.pageIndex, pagination.pageSize, sorting, grouping]);

  // Effet pour fetch initial et re-fetch sur changements
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Créer la table TanStack
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount,
    state: {
      pagination,
      sorting,
      grouping,
      expanded,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onGroupingChange: setGrouping,
    onExpandedChange: (updaterOrValue) => {
      setExpanded((prev) =>
        typeof updaterOrValue === 'function'
          ? updaterOrValue(prev)
          : updaterOrValue
      );
    },
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-96 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-64 animate-pulse rounded border bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="font-semibold text-foreground text-xl">{config.name}</h2>
        {config.description && (
          <p className="text-muted-foreground text-sm">{config.description}</p>
        )}
      </div>

      {/* Contrôles de grouping simples */}
      <div className="flex gap-2">
        <Button
          onClick={() => {
            setGrouping((prev) =>
              prev.includes('brand')
                ? prev.filter((g) => g !== 'brand')
                : [...prev, 'brand']
            );
          }}
          size="sm"
          type="button"
          variant={grouping.includes('brand') ? 'default' : 'outline'}
        >
          Group by Brand
        </Button>
        <Button
          onClick={() => {
            setGrouping((prev) =>
              prev.includes('category')
                ? prev.filter((g) => g !== 'category')
                : [...prev, 'category']
            );
          }}
          size="sm"
          type="button"
          variant={grouping.includes('category') ? 'default' : 'outline'}
        >
          Group by Category
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  data-state={row.getIsSelected() && 'selected'}
                  key={row.id}
                  style={{
                    paddingLeft: `${row.depth * 2}rem`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-24 text-center"
                  colSpan={columns.length}
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination sécurisée sans Select Radix */}
      <SafePagination rowCount={totalCount} table={table} />
    </div>
  );
};
