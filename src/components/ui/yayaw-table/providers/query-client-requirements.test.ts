import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { QueryClient } from "@tanstack/react-query";
import {
  resolveTableQueryClient,
  TABLE_PROVIDER_DUPLICATE_QUERY_CLIENT_ERROR,
  TABLE_PROVIDER_MISSING_QUERY_CLIENT_ERROR,
} from "./query-client-requirements";

function createFakeQueryClient(name: string): QueryClient {
  return {
    name,
  } as unknown as QueryClient;
}

describe("resolveTableQueryClient", () => {
  it("uses the provider client when no explicit queryClient is provided", () => {
    const providerQueryClient = createFakeQueryClient("provider");

    const resolution = resolveTableQueryClient({
      providerQueryClient,
    });

    assert.equal(resolution.queryClient, providerQueryClient);
    assert.equal(resolution.shouldProvideQueryClient, false);
  });

  it("uses explicit queryClient when no provider exists", () => {
    const explicitQueryClient = createFakeQueryClient("explicit");

    const resolution = resolveTableQueryClient({
      explicitQueryClient,
    });

    assert.equal(resolution.queryClient, explicitQueryClient);
    assert.equal(resolution.shouldProvideQueryClient, true);
  });

  it("throws an explicit error when no query client is available", () => {
    assert.throws(
      () => {
        resolveTableQueryClient({});
      },
      {
        message: TABLE_PROVIDER_MISSING_QUERY_CLIENT_ERROR,
      }
    );
  });

  it("throws when provider and explicit queryClient are different instances", () => {
    const providerQueryClient = createFakeQueryClient("provider");
    const explicitQueryClient = createFakeQueryClient("explicit");

    assert.throws(
      () => {
        resolveTableQueryClient({
          explicitQueryClient,
          providerQueryClient,
        });
      },
      {
        message: TABLE_PROVIDER_DUPLICATE_QUERY_CLIENT_ERROR,
      }
    );
  });

  it("accepts provider + explicit queryClient when they are the same instance", () => {
    const sharedQueryClient = createFakeQueryClient("shared");

    const resolution = resolveTableQueryClient({
      explicitQueryClient: sharedQueryClient,
      providerQueryClient: sharedQueryClient,
    });

    assert.equal(resolution.queryClient, sharedQueryClient);
    assert.equal(resolution.shouldProvideQueryClient, false);
  });
});
