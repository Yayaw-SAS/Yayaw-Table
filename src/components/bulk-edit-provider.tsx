"use client";

import { toast } from "sonner";
import { useBulkEdit } from "@/ui/yayaw_table/hooks/use-bulk-edit";
import { useTableActions } from "@/ui/yayaw_table/providers/table-provider";

interface BulkEditProviderProps {
  children: (bulkEdit: ReturnType<typeof useBulkEdit>) => React.ReactNode;
}

/**
 * Client-side wrapper for bulk edit functionality
 * This prevents SSR issues with QueryClient and integrates with table actions
 */
export function BulkEditProvider({ children }: BulkEditProviderProps) {
  const getTableActions = useTableActions();
  const actions = getTableActions?.("products");

  const bulkEdit = useBulkEdit({
    tableId: "products",
    formType: "products-bulk",
    onSuccess: (_updatedData, selectedRows) => {
      toast.success(`Successfully updated ${selectedRows.length} products`);
    },
    onUpdate: async (ids, data) => {
      if (
        actions &&
        "bulkUpdate" in actions &&
        typeof actions.bulkUpdate === "function"
      ) {
        const result = await actions.bulkUpdate(ids, data);
        return result.success;
      }
      return false;
    },
  });

  return <>{children(bulkEdit)}</>;
}
