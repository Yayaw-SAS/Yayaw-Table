'use client';

import { toast } from 'sonner';
import { useBulkEdit, useTableActions } from '../../../index';

interface BulkEditProviderProps {
  children: (bulkEdit: ReturnType<typeof useBulkEdit>) => React.ReactNode;
}

/**
 * Client-side wrapper for bulk edit functionality
 * This prevents SSR issues with QueryClient and integrates with table actions
 */
export function BulkEditProvider({ children }: BulkEditProviderProps) {
  // Get table actions from provider
  const getTableActions = useTableActions();
  const actions = getTableActions?.('products');

  // Setup bulk edit functionality
  const bulkEdit = useBulkEdit({
    tableId: 'products',
    formType: 'products-bulk',
    onSuccess: (updatedData, selectedRows) => {
      toast.success(`Successfully updated ${selectedRows.length} products`);
      console.log('Bulk edit completed:', {
        updatedData,
        affectedRows: selectedRows.length,
      });
    },
    onUpdate: async (ids, data) => {
      // Use the bulkUpdate action from the provider
      if (
        actions &&
        'bulkUpdate' in actions &&
        typeof actions.bulkUpdate === 'function'
      ) {
        const result = await actions.bulkUpdate(ids, data);
        return result.success;
      }

      // Fallback for providers without bulkUpdate
      console.warn('No bulkUpdate action found in provider, using fallback');
      return false;
    },
  });

  return <>{children(bulkEdit)}</>;
}
