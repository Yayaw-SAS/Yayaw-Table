'use client';

import type { Row } from '@tanstack/react-table';
import { toast } from 'sonner';
import { DataTable, useTableActions } from '../../../index';

interface TableWithActionsProps {
  onBulkEdit: (rows: Row<Record<string, unknown>>[]) => void;
}

/**
 * DataTable component with integrated bulk actions
 * Uses actions from the table provider for copy and delete operations
 */
export function TableWithActions({ onBulkEdit }: TableWithActionsProps) {
  // Get table actions from provider
  const getTableActions = useTableActions();
  const actions = getTableActions?.('products') as
    | {
        bulkDelete?: (
          ids: string[]
        ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
        bulkCopy?: (
          ids: string[]
        ) => Promise<{ success: boolean; data?: string; error?: string }>;
      }
    | undefined;

  const handleBulkDelete = async (rows: Row<Record<string, unknown>>[]) => {
    if (!actions?.bulkDelete) {
      toast.error('Bulk delete not available');
      return;
    }

    const ids = rows.map((row) => row.original.id as string);
    const itemNames = rows.map((row) => row.original.name).join(', ');

    const confirmed = window.confirm(
      `⚠️ Delete Confirmation\n\nAre you sure you want to delete ${rows.length} item${rows.length > 1 ? 's' : ''}?\n\n${itemNames}\n\nThis action cannot be undone.`
    );

    if (confirmed) {
      try {
        const result = await actions.bulkDelete(ids);

        if (result.success) {
          toast.success(`Successfully deleted ${ids.length} products`);
          console.log('Bulk delete completed:', result.data);
        } else {
          toast.error(result.error || 'Failed to delete products');
        }
      } catch (error) {
        console.error('Bulk delete error:', error);
        toast.error('Failed to delete products');
      }
    }
  };

  const handleBulkCopy = async (rows: Row<Record<string, unknown>>[]) => {
    if (!actions?.bulkCopy) {
      toast.error('Bulk copy not available');
      return;
    }

    try {
      const ids = rows.map((row) => row.original.id as string);
      const result = await actions.bulkCopy(ids);

      if (result.success && result.data) {
        // Copy to clipboard
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(result.data);
          toast.success(`📋 Copied ${rows.length} products to clipboard!`);
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = result.data;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          toast.success(`📋 Copied ${rows.length} products to clipboard!`);
        }

        console.log('Bulk copy completed:', rows.length, 'items');
      } else {
        toast.error(result.error || 'Failed to copy products');
      }
    } catch (error) {
      console.error('Bulk copy error:', error);
      toast.error('❌ Failed to copy products to clipboard');
    }
  };

  return (
    <DataTable
      columnTypeMapping={{
        // Map table config types to filter types
        name: 'text',
        brand: 'text',
        category: 'option', // tag -> option for dropdown
        price: 'number',
        status: 'option', // tag -> option for dropdown
        createdAt: 'date',
        isActive: 'option', // boolean -> option for true/false
      }}
      description="Production-ready table with server-side pagination, filtering, and sorting. Select multiple rows to see bulk actions!"
      enableAdvancedFilters={true}
      onBulkCopy={handleBulkCopy}
      onBulkDelete={handleBulkDelete}
      onBulkEdit={onBulkEdit}
      tableType="products"
      title="Products Management"
    />
  );
}
