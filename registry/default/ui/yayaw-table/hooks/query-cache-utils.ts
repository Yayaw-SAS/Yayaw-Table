import type { QueryClient } from "@tanstack/react-query";

export async function invalidateTableDataQuery({
  queryClient,
  tableId,
}: {
  queryClient: Pick<QueryClient, "invalidateQueries">;
  tableId: string;
}): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: ["tableData", tableId],
  });
}

export async function invalidateAndRefetchTableData<TData>({
  queryClient,
  refetch,
  tableId,
}: {
  queryClient: Pick<QueryClient, "invalidateQueries">;
  refetch: () => Promise<TData>;
  tableId: string;
}): Promise<TData> {
  await invalidateTableDataQuery({ queryClient, tableId });
  return await refetch();
}
