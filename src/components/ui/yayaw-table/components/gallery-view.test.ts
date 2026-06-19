import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TableCatalogueColumnConfig } from "../hooks/use-table-config";
import { getImageFallbackInitial, resolveImageSource } from "../utils/image-source";
import {
  createGalleryGroups,
  resolveGalleryDisplayConfig,
  resolveGalleryImageColumnId,
  resolveGalleryLinkColumnId,
  resolveGalleryLinkUrl,
  resolveGalleryPropertyColumnIds,
  resolveGalleryTitleColumnId,
  shouldShowGalleryCardLabels,
} from "./gallery-view";

const columns: TableCatalogueColumnConfig[] = [
  { header: "Select", id: "select", type: "select" },
  { header: "Image", id: "imageUrl", type: "image" },
  { header: "Name", id: "name", type: "text" },
  { header: "Brand", id: "brand", type: "text" },
  { header: "Status", id: "status", type: "tag" },
  { header: "Website", id: "website", type: "url", urlDisplayMode: "icon" },
  { header: "Actions", id: "actions", type: "actions" },
];

describe("Gallery display helpers", () => {
  it("uses compact gallery defaults", () => {
    const config = resolveGalleryDisplayConfig(undefined);

    assert.equal(config.aspectRatio, "wide");
    assert.equal(config.cardSize, "medium");
    assert.equal(config.imageFit, "cover");
    assert.equal(config.showCardLabels, false);
    assert.equal(shouldShowGalleryCardLabels(undefined), false);
    assert.equal(shouldShowGalleryCardLabels({ showCardLabels: true }), true);
  });

  it("resolves image, title, and property columns", () => {
    const imageColumnId = resolveGalleryImageColumnId({
      columnDefinitions: columns,
      config: undefined,
    });
    const titleColumnId = resolveGalleryTitleColumnId({
      columnDefinitions: columns,
      config: undefined,
    });

    assert.equal(imageColumnId, "imageUrl");
    assert.equal(titleColumnId, "name");
    assert.deepEqual(
      resolveGalleryPropertyColumnIds({
        columnDefinitions: columns,
        config: undefined,
        imageColumnId,
        titleColumnId,
      }),
      ["brand", "status", "website"]
    );
  });

  it("keeps configured property order and explicit empty properties", () => {
    assert.deepEqual(
      resolveGalleryPropertyColumnIds({
        columnDefinitions: columns,
        config: { cardColumnIds: ["status", "missing", "brand"] },
        imageColumnId: "imageUrl",
        titleColumnId: "name",
      }),
      ["status", "brand"]
    );
    assert.deepEqual(
      resolveGalleryPropertyColumnIds({
        columnDefinitions: columns,
        config: { cardColumnIds: [] },
        imageColumnId: "imageUrl",
        titleColumnId: "name",
      }),
      []
    );
  });

  it("resolves the gallery link column from row-link or URL columns", () => {
    assert.equal(resolveGalleryLinkColumnId({ columnDefinitions: columns }), "website");

    assert.equal(
      resolveGalleryLinkColumnId({
        columnDefinitions: [
          ...columns,
          {
            header: "Details",
            id: "detailsUrl",
            type: "url",
            urlDisplayMode: "row-link",
          },
        ],
      }),
      "detailsUrl"
    );
  });

  it("builds gallery sections from the primary group value", () => {
    const rows = [
      { id: "1", original: { status: "Draft" } },
      { id: "2", original: { status: "Published" } },
      { id: "3", original: { status: "Draft" } },
      { id: "4", original: { status: null } },
    ] as unknown as import("@tanstack/react-table").Row<
      Record<string, unknown>
    >[];

    const groups = createGalleryGroups({ groupBy: "status", rows });

    assert.deepEqual(
      groups.map((group) => ({
        label: group.label,
        rowIds: group.rows.map((row) => row.id),
      })),
      [
        { label: "Draft", rowIds: ["1", "3"] },
        { label: "Published", rowIds: ["2"] },
        { label: "No value", rowIds: ["4"] },
      ]
    );
  });
});

describe("Gallery image source helpers", () => {
  it("accepts supported image URLs and rejects unsafe or empty values", () => {
    assert.equal(resolveImageSource("/example/products/laptop.svg"), "/example/products/laptop.svg");
    assert.equal(resolveImageSource("https://example.com/image.png"), "https://example.com/image.png");
    assert.equal(resolveImageSource("data:image/png;base64,abcd"), "data:image/png;base64,abcd");
    assert.equal(resolveImageSource("javascript:alert(1)"), undefined);
    assert.equal(resolveImageSource("//example.com/image.png"), undefined);
    assert.equal(resolveImageSource(""), undefined);
  });

  it("returns a readable fallback initial", () => {
    assert.equal(getImageFallbackInitial("Laptop"), "L");
    assert.equal(getImageFallbackInitial(""), "?");
    assert.equal(getImageFallbackInitial(undefined), "?");
  });
});

describe("Gallery link helpers", () => {
  it("accepts HTTP URLs and rejects unsafe or empty link values", () => {
    assert.equal(resolveGalleryLinkUrl("https://example.com/product"), "https://example.com/product");
    assert.equal(resolveGalleryLinkUrl("http://example.com/product"), "http://example.com/product");
    assert.equal(resolveGalleryLinkUrl("mailto:sales@example.com"), undefined);
    assert.equal(resolveGalleryLinkUrl("javascript:alert(1)"), undefined);
    assert.equal(resolveGalleryLinkUrl(""), undefined);
    assert.equal(resolveGalleryLinkUrl(undefined), undefined);
  });
});
