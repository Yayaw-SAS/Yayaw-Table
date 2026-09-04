import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import {
  defaultTranslations,
  TableProvider,
} from "../../../providers/table-provider";
import type { AnyFieldDefinition } from "../types";
import { CollectionEditor } from "./collection-field";

const FEATURES_LABEL_PATTERN = /Features/;
const EMPTY_FEATURES_PATTERN = /No features yet/;
const ADD_FEATURE_PATTERN = /Add feature/;

describe("CollectionEditor", () => {
  it("renders an empty collection state", () => {
    const html = renderToStaticMarkup(
      <TableProvider
        queryClient={new QueryClient()}
        tableId="collection-test"
        translations={defaultTranslations}
      >
        <CollectionEditor
          addLabel="Add feature"
          columns={[{ header: "Feature", id: "label" }]}
          createItem={() => ({ label: "" })}
          emptyLabel="No features yet"
          itemLabel="feature"
          label="Features"
          onChange={() => undefined}
          renderItemForm={() => null}
          value={[]}
        />
      </TableProvider>
    );

    assert.match(html, FEATURES_LABEL_PATTERN);
    assert.match(html, EMPTY_FEATURES_PATTERN);
    assert.match(html, ADD_FEATURE_PATTERN);
  });

  it("keeps existing text, select, custom, and collection definitions assignable", () => {
    const fields: AnyFieldDefinition<Record<string, unknown>>[] = [
      { label: "Name", name: "name", type: "text" },
      {
        label: "Status",
        name: "status",
        options: [{ label: "Draft", value: "draft" }],
        type: "select",
      },
      {
        label: "Custom",
        name: "custom",
        renderField: () => null,
        type: "custom",
      },
      {
        addLabel: "Add feature",
        columns: [{ header: "Feature", id: "label" }],
        createItem: () => ({ label: "" }),
        itemLabel: "feature",
        label: "Features",
        name: "features",
        renderItemForm: () => null,
        type: "collection",
      },
    ];

    assert.equal(fields.length, 4);
  });
});
