/**
 * Tag column component for data tables
 * Displays tag values with colored backgrounds
 */
'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { type LucideIcon, Tag } from 'lucide-react';

import { TagCell } from '../cells/tag-cell';

/**
 * Options for creating a tag column
 */
export interface TagColumnOptions {
  /**
   * Optional CSS class name
   */
  className?: string;

  /**
   * Whether the column can be filtered
   * @default true
   */
  enableColumnFilter?: boolean;

  /**
   * Whether the column can be hidden
   * @default true
   */
  enableHiding?: boolean;

  /**
   * Whether the column can be sorted
   * @default true
   */
  enableSorting?: boolean;

  /**
   * Header text for the column
   */
  header: string;

  /**
   * Unique identifier for the column
   */
  id: string;
}

/**
 * Custom properties for our column definitions
 */
type CustomColumnProps = {
  icon?: LucideIcon;
  type?: string;
};

/**
 * Combined type for our column definition
 */
type ExtendedColumnDef<TData> = ColumnDef<TData> & CustomColumnProps;

/**
 * Creates a column definition for displaying tag values with colored backgrounds
 */
export function createTagColumn<TData>({
  className = '',
  enableColumnFilter = true,
  enableHiding = true,
  enableSorting = true,
  header,
  id,
}: TagColumnOptions): ExtendedColumnDef<TData> {
  return {
    accessorFn: (row: TData) => (row as Record<string, unknown>)[id],
    cell: ({ getValue }) => (
      <TagCell className={className} value={getValue()} />
    ),
    enableColumnFilter,
    enableHiding,
    enableSorting,
    header,
    icon: Tag,
    id,
    type: 'tag',
  };
}
