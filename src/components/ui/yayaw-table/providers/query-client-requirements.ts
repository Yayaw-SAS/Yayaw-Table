import type { QueryClient } from "@tanstack/react-query";

export const TABLE_PROVIDER_MISSING_QUERY_CLIENT_ERROR =
  "[YaYaw Table] Missing QueryClient. Wrap your app with a shared QueryClientProvider or pass a shared queryClient prop to DataTable/TableProvider. The implicit internal QueryClient has been removed.";

export const TABLE_PROVIDER_DUPLICATE_QUERY_CLIENT_ERROR =
  "[YaYaw Table] Duplicate QueryClient detected. DataTable/TableProvider received a queryClient prop that differs from the surrounding QueryClientProvider client. Use exactly one shared QueryClient instance to avoid isolated caches.";

export interface ResolveTableQueryClientOptions {
  explicitQueryClient?: QueryClient;
  providerQueryClient?: QueryClient;
}

export interface ResolvedTableQueryClient {
  queryClient: QueryClient;
  shouldProvideQueryClient: boolean;
}

export function resolveTableQueryClient(
  options: ResolveTableQueryClientOptions
): ResolvedTableQueryClient {
  const { explicitQueryClient, providerQueryClient } = options;

  if (
    explicitQueryClient &&
    providerQueryClient &&
    explicitQueryClient !== providerQueryClient
  ) {
    throw new Error(TABLE_PROVIDER_DUPLICATE_QUERY_CLIENT_ERROR);
  }

  const queryClient = explicitQueryClient ?? providerQueryClient;

  if (!queryClient) {
    throw new Error(TABLE_PROVIDER_MISSING_QUERY_CLIENT_ERROR);
  }

  return {
    queryClient,
    shouldProvideQueryClient: Boolean(explicitQueryClient && !providerQueryClient),
  };
}
