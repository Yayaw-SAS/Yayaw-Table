import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type CollectionItem,
  createCollectionFieldValidators,
  getCollectionValidationMessages,
  insertCollectionItem,
  moveCollectionItem,
  normalizeCollectionItems,
  removeCollectionItem,
  replaceCollectionItem,
} from "./collection-field-utils";

const createFeature = (items: readonly CollectionItem[]) => ({
  id: `feature-${items.length + 1}`,
  label: "",
});

describe("collection field state helpers", () => {
  it("normalizes non-array values into an empty collection", () => {
    assert.deepEqual(normalizeCollectionItems(undefined), []);
    assert.deepEqual(normalizeCollectionItems({ label: "Feature" }), []);
  });

  it("adds an item created from the current items", () => {
    const items = [{ id: "feature-1", label: "Search" }];
    const nextItems = insertCollectionItem(items, createFeature(items));

    assert.deepEqual(nextItems, [
      { id: "feature-1", label: "Search" },
      { id: "feature-2", label: "" },
    ]);
    assert.notEqual(nextItems, items);
  });

  it("adds items from multiple create actions", () => {
    const actions: Array<{
      createItem: (items: readonly CollectionItem[]) => CollectionItem;
      label: string;
    }> = [
      {
        label: "Add link",
        createItem: () => ({ href: "/", type: "link" }),
      },
      {
        label: "Add group",
        createItem: () => ({ items: [], label: "", type: "group" }),
      },
    ];

    let items: CollectionItem[] = [];
    for (const action of actions) {
      items = insertCollectionItem(items, action.createItem(items));
    }

    assert.deepEqual(items, [
      { href: "/", type: "link" },
      { items: [], label: "", type: "group" },
    ]);
  });

  it("edits an item without mutating the original array", () => {
    const items = [
      { id: "feature-1", label: "Search" },
      { id: "feature-2", label: "Filters" },
    ];
    const nextItems = replaceCollectionItem(items, 1, {
      id: "feature-2",
      label: "Advanced filters",
    });

    assert.deepEqual(items[1], { id: "feature-2", label: "Filters" });
    assert.deepEqual(nextItems[1], {
      id: "feature-2",
      label: "Advanced filters",
    });
  });

  it("removes an item", () => {
    const items = [
      { id: "feature-1", label: "Search" },
      { id: "feature-2", label: "Filters" },
    ];

    assert.deepEqual(removeCollectionItem(items, 0), [
      { id: "feature-2", label: "Filters" },
    ]);
  });

  it("moves items up and down", () => {
    const items = [
      { id: "feature-1" },
      { id: "feature-2" },
      { id: "feature-3" },
    ];

    assert.deepEqual(moveCollectionItem(items, 2, 1), [
      { id: "feature-1" },
      { id: "feature-3" },
      { id: "feature-2" },
    ]);
    assert.deepEqual(moveCollectionItem(items, 0, 1), [
      { id: "feature-2" },
      { id: "feature-1" },
      { id: "feature-3" },
    ]);
  });
});

describe("collection field validation", () => {
  const validationField = {
    itemLabel: "Feature",
    validateItem: (item: CollectionItem) =>
      typeof item.label === "string" && item.label.length > 0
        ? []
        : ["Label is required"],
    validateItems: (items: readonly CollectionItem[]) =>
      items.length > 0 ? [] : ["Add at least one feature"],
  };

  it("returns row validation errors", () => {
    assert.deepEqual(getCollectionValidationMessages(validationField, [{}]), [
      "Feature 1: Label is required",
    ]);
  });

  it("returns global validation errors", () => {
    assert.deepEqual(getCollectionValidationMessages(validationField, []), [
      "Add at least one feature",
    ]);
  });

  it("returns submit validators that block invalid collections", () => {
    const validators = createCollectionFieldValidators(validationField);

    assert.deepEqual(validators.onSubmit({ value: [{}] }), [
      "Feature 1: Label is required",
    ]);
    assert.equal(
      validators.onSubmit({ value: [{ label: "Search" }] }),
      undefined
    );
  });

  it("supports nested collections through controlled item updates", () => {
    const group = {
      items: [{ href: "/docs", label: "Docs" }],
      label: "Resources",
      type: "group",
    };
    const nextNestedItems = insertCollectionItem(
      normalizeCollectionItems(group.items),
      { href: "/blog", label: "Blog" }
    );
    const nextGroup = replaceCollectionItem([group], 0, {
      ...group,
      items: nextNestedItems,
    })[0];

    assert.deepEqual(nextGroup, {
      items: [
        { href: "/docs", label: "Docs" },
        { href: "/blog", label: "Blog" },
      ],
      label: "Resources",
      type: "group",
    });
  });
});
