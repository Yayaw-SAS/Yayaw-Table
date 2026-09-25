import assert from "node:assert/strict";
import type * as Catalog from "../src/components/ui/yayaw-table/utils/tag-catalog";
import type * as Colors from "../src/components/ui/yayaw-table/utils/tag-colors";

type Test = (name: string, run: () => void | Promise<void>) => void;

/** The part of TanStack Query's client both editions cache catalogs with. */
interface CatalogQueryClient {
  fetchQuery: (options: {
    queryKey: readonly unknown[];
    queryFn: () => Promise<unknown>;
    staleTime?: number;
  }) => Promise<unknown>;
  invalidateQueries: (filters: {
    queryKey: readonly unknown[];
  }) => Promise<void>;
}

export type TagHelper =
  | "applyTagPatch"
  | "catalogAfterMerge"
  | "catalogAfterRemove"
  | "catalogAfterUpdate"
  | "catalogWithTag"
  | "countTagLabel"
  | "createTag"
  | "filterTags"
  | "findTagByName"
  | "formatTagLabel"
  | "isTagPatch"
  | "mergeTagValue"
  | "normalizeTagList"
  | "planTagBulkUpdate"
  | "removeTagValue"
  | "resolveTagColumn"
  | "resolveTagLabels"
  | "selectionTagUsage"
  | "tagCatalogQuery"
  | "tagCatalogQueryKey"
  | "tagColumnForField"
  | "tagColumnsOf"
  | "tagCreateName"
  | "tagLabels"
  | "tagUsageCounts"
  | "tagUsageRequest"
  | "withTagCatalogOptions"
  | "withTagSelected";

export type ColorHelper =
  | "isTagColorName"
  | "TAG_COLOR_NAMES"
  | "tagAppearance"
  | "tagColorValue"
  | "tagSwatchColor";

const NO_ACCESS = /No access/;
const NOT_LOADED = /Tags could not be loaded/;
const TAKEN = /Taken/;
const CANNOT_CREATE = /cannot be created/;
const NO_ID = /no id/;
const AUTOMATIC_HUE = /^hsl\(\d+ 70% 45%\)$/;

const scope = { tableId: "assets", tableType: "assets", columnId: "tags" };
const catalog: Catalog.TableTag[] = [
  { id: "t-brand", name: "Brand", color: "blue" },
  { id: "t-social", name: "Social" },
  { id: "t-print", name: "Print", color: "#dc2626" },
  { id: "t-ete", name: "Été" },
];

/**
 * Tag catalogs in both editions: the column contract, the cached catalog,
 * create on the fly, bulk add/remove patches, merge and delete effects,
 * usage counts, labels and colors.
 */
export function tagCatalogSuite(
  test: Test,
  tags: Pick<typeof Catalog, TagHelper>,
  colors: Pick<typeof Colors, ColorHelper>,
  createQueryClient: () => CatalogQueryClient
) {
  test("columns opt in with tags and read their field, shape and settings", () => {
    assert.equal(
      tags.resolveTagColumn({ id: "name", type: "text" }),
      undefined
    );
    assert.deepEqual(
      tags.resolveTagColumn({ id: "tags", type: "multiSelect", tags: true }),
      {
        columnId: "tags",
        field: "tags",
        multiple: true,
        create: true,
        manage: true,
        bulk: "values",
      }
    );
    assert.deepEqual(
      tags.resolveTagColumn({
        id: "label",
        type: "select",
        accessorKey: "labelId",
        tags: { create: false, manage: false, bulk: "patch" },
      }),
      {
        columnId: "label",
        field: "labelId",
        multiple: false,
        create: false,
        manage: false,
        bulk: "patch",
      }
    );
    assert.equal(
      tags.resolveTagColumn({
        id: "keywords",
        tags: true,
        accessorKey: "raw",
        inlineEdit: { formField: "keywordIds" },
      })?.field,
      "keywordIds"
    );
    assert.equal(
      tags.resolveTagColumn({ id: "select", type: "multiSelect", tags: true }),
      undefined
    );
    const columns = tags.tagColumnsOf([
      { id: "name", type: "text" },
      { id: "tags", type: "multiSelect", tags: true },
      { id: "owner", type: "select", accessorKey: "ownerId", tags: {} },
    ]);
    assert.deepEqual(
      columns.map((column) => column.columnId),
      ["tags", "owner"]
    );
    assert.equal(tags.tagColumnForField(columns, "ownerId")?.columnId, "owner");
    assert.equal(tags.tagColumnForField(columns, "owner")?.columnId, "owner");
    assert.equal(tags.tagColumnForField(columns, "name"), undefined);
  });

  test("list answers become a clean catalog; failures throw their error", () => {
    assert.deepEqual(
      tags.normalizeTagList([
        { id: 7, name: "  Seven  ", color: " green " },
        { id: "7", name: "Duplicate" },
        { name: "No id" },
        null,
        { id: "blank", name: "  " },
      ]),
      [
        { id: "7", name: "Seven", color: "green" },
        { id: "blank", name: "blank" },
      ]
    );
    assert.deepEqual(
      tags.normalizeTagList({ success: true, data: [{ id: "a", name: "A" }] }),
      [{ id: "a", name: "A" }]
    );
    assert.deepEqual(tags.normalizeTagList({ success: true }), []);
    assert.throws(
      () => tags.normalizeTagList({ success: false, error: "No access" }),
      NO_ACCESS
    );
    assert.throws(() => tags.normalizeTagList({ success: false }), NOT_LOADED);
  });

  test("a loaded catalog replaces the column's options; static ones stay until then", () => {
    const definitions = [
      { id: "name", header: "Name", type: "text" },
      {
        id: "tags",
        header: "Tags",
        type: "multiSelect",
        tags: true,
        options: [{ value: "t-brand", label: "Static brand" }],
      },
      { id: "kind", header: "Kind", tags: true },
    ];
    assert.equal(tags.withTagCatalogOptions(definitions, {}), definitions);
    const next = tags.withTagCatalogOptions(definitions, {
      tags: catalog,
      kind: [{ id: "k", name: "Kind" }],
    });
    assert.notEqual(next, definitions);
    assert.equal(next[0], definitions[0]);
    assert.deepEqual(next[1]?.options, [
      { value: "t-brand", label: "Brand", color: "blue" },
      { value: "t-social", label: "Social" },
      { value: "t-print", label: "Print", color: "#dc2626" },
      { value: "t-ete", label: "Été" },
    ]);
    assert.equal(next[1]?.displayVariant, "tag");
    // A tags column without an option type is a list of tags.
    assert.equal(next[2]?.type, "multiSelect");
  });

  test("a catalog loads once per table and column, and again once invalidated", async () => {
    const client = createQueryClient();
    const calls: Catalog.TableTagScope[] = [];
    const actions = {
      list: (input: Catalog.TableTagScope) => {
        calls.push(input);
        return Promise.resolve({ success: true, data: catalog });
      },
    };
    const first = await client.fetchQuery(tags.tagCatalogQuery(actions, scope));
    const again = await client.fetchQuery(tags.tagCatalogQuery(actions, scope));
    assert.deepEqual(first, catalog);
    assert.equal(again, first);
    assert.deepEqual(calls, [scope]);

    await client.fetchQuery(
      tags.tagCatalogQuery(actions, { ...scope, columnId: "labels" })
    );
    await client.fetchQuery(
      tags.tagCatalogQuery(actions, { ...scope, tableId: "assets-trash" })
    );
    assert.equal(calls.length, 3);

    // Every catalog of a table sits under the table's key.
    await client.invalidateQueries({ queryKey: ["yayaw-table", "assets"] });
    await client.fetchQuery(tags.tagCatalogQuery(actions, scope));
    assert.equal(calls.length, 4);
    assert.deepEqual(tags.tagCatalogQueryKey(scope), [
      "yayaw-table",
      "assets",
      "tags",
      "assets",
      "tags",
    ]);
  });

  test("pickers search names without case or accents and offer to create new ones", () => {
    assert.deepEqual(
      tags.filterTags(catalog, "").map((tag) => tag.id),
      catalog.map((tag) => tag.id)
    );
    assert.deepEqual(
      tags.filterTags(catalog, "ete").map((tag) => tag.id),
      ["t-ete"]
    );
    assert.deepEqual(
      tags
        .filterTags(
          [
            { id: "a", name: "Reprint" },
            { id: "b", name: "Print" },
          ],
          "print"
        )
        .map((tag) => tag.id),
      ["b", "a"]
    );
    assert.equal(tags.findTagByName(catalog, "  BRAND ")?.id, "t-brand");
    assert.equal(tags.tagCreateName("  ", catalog), undefined);
    assert.equal(tags.tagCreateName("social", catalog), undefined);
    assert.equal(tags.tagCreateName("ÉTÉ", catalog), undefined);
    assert.equal(
      tags.tagCreateName("  Summer   sale ", catalog),
      "Summer sale"
    );
  });

  test("creating on the fly calls create once and selects the new tag", async () => {
    const created: Catalog.TableTagCreateInput[] = [];
    const actions = {
      create: (input: Catalog.TableTagCreateInput) => {
        created.push(input);
        return Promise.resolve({
          success: true,
          data: { id: "t-new", name: input.name },
        });
      },
    };
    const result = await tags.createTag({
      actions,
      scope,
      tags: catalog,
      name: " Summer  sale ",
    });
    assert.deepEqual(created, [{ ...scope, name: "Summer sale" }]);
    assert.deepEqual(result, {
      tag: { id: "t-new", name: "Summer sale" },
      created: true,
    });
    assert.deepEqual(tags.withTagSelected(["t-brand"], "t-new", true), [
      "t-brand",
      "t-new",
    ]);
    assert.deepEqual(tags.withTagSelected(["t-new"], "t-new", true), ["t-new"]);
    assert.equal(tags.withTagSelected("t-brand", "t-new", false), "t-new");
    assert.deepEqual(tags.catalogWithTag(catalog, result.tag).at(-1), {
      id: "t-new",
      name: "Summer sale",
    });

    // An existing name selects that tag without calling the host.
    const existing = await tags.createTag({
      actions,
      scope,
      tags: catalog,
      name: "print",
    });
    assert.deepEqual(existing, { tag: catalog[2], created: false });
    assert.equal(created.length, 1);

    await assert.rejects(
      tags.createTag({
        actions: {
          create: () => Promise.resolve({ success: false, error: "Taken" }),
        },
        scope,
        tags: catalog,
        name: "Other",
      }),
      TAKEN
    );
    await assert.rejects(
      tags.createTag({ actions: {}, scope, tags: catalog, name: "Other" }),
      CANNOT_CREATE
    );
    await assert.rejects(
      tags.createTag({
        actions: { create: () => ({ name: "No id" }) },
        scope,
        tags: catalog,
        name: "Other",
      }),
      NO_ID
    );
  });

  test("bulk add and remove patch lists in order, without repeats", () => {
    assert.deepEqual(tags.applyTagPatch(["a", "b"], { add: ["c", "a"] }), [
      "a",
      "b",
      "c",
    ]);
    assert.deepEqual(tags.applyTagPatch(["a", "b", "c"], { remove: ["b"] }), [
      "a",
      "c",
    ]);
    assert.deepEqual(tags.applyTagPatch(null, { add: ["a"] }), ["a"]);
    assert.deepEqual(tags.applyTagPatch("a", { add: ["b"] }), ["a", "b"]);
    assert.deepEqual(
      tags.applyTagPatch(["a", "b"], { add: ["b"], remove: ["b"] }),
      ["a", "b"]
    );
    assert.equal(tags.isTagPatch({ add: ["a"], remove: [] }), true);
    assert.equal(tags.isTagPatch({ add: ["a"], other: 1 }), false);
    assert.equal(tags.isTagPatch(["a"]), false);
    assert.equal(tags.isTagPatch({}), false);
  });

  test("values mode groups rows by their resulting tags and skips unchanged rows", () => {
    const rows = [
      { id: "1", value: ["t-brand"] },
      { id: "2", value: [] },
      { id: "3", value: ["t-brand", "t-sale"] },
      { id: "4", value: null },
    ];
    const plan = tags.planTagBulkUpdate({
      rows,
      field: "tagIds",
      patch: { add: ["t-sale"] },
      mode: "values",
    });
    assert.deepEqual(plan.calls, [
      { ids: ["1"], patch: { tagIds: ["t-brand", "t-sale"] } },
      { ids: ["2", "4"], patch: { tagIds: ["t-sale"] } },
    ]);
    assert.deepEqual(plan.unchanged, ["3"]);
    assert.deepEqual(plan.next, {
      "1": ["t-brand", "t-sale"],
      "2": ["t-sale"],
      "3": ["t-brand", "t-sale"],
      "4": ["t-sale"],
    });
  });

  test("patch mode sends one add/remove patch for every selected row", () => {
    const plan = tags.planTagBulkUpdate({
      rows: [
        { id: "1", value: ["t-brand", "t-print"] },
        { id: "2", value: ["t-social"] },
      ],
      field: "tags",
      patch: { remove: ["t-print", "t-print"] },
      mode: "patch",
    });
    assert.deepEqual(plan.calls, [
      { ids: ["1", "2"], patch: { tags: { add: [], remove: ["t-print"] } } },
    ]);
    assert.deepEqual(plan.next, { "1": ["t-brand"], "2": ["t-social"] });
    assert.deepEqual(plan.unchanged, ["2"]);
    assert.deepEqual(
      tags.planTagBulkUpdate({
        rows: [],
        field: "tags",
        patch: { add: ["a"] },
        mode: "patch",
      }).calls,
      []
    );
  });

  test("remove offers the selection's tags, most used first", () => {
    assert.deepEqual(
      tags
        .selectionTagUsage(
          [["t-print", "t-brand"], ["t-brand"], null, ["gone"]],
          catalog
        )
        .map(({ tag, count }) => [tag.id, tag.name, count]),
      [
        ["t-brand", "Brand", 2],
        ["t-print", "Print", 1],
        ["gone", "gone", 1],
      ]
    );
  });

  test("merging replaces the sources by the target in records and the catalog", () => {
    assert.deepEqual(
      tags.mergeTagValue(
        ["t-social", "t-brand", "t-print"],
        ["t-social", "t-print"],
        "t-brand"
      ),
      ["t-brand"]
    );
    assert.deepEqual(
      tags.mergeTagValue(["t-social", "t-ete"], ["t-social"], "t-brand"),
      ["t-brand", "t-ete"]
    );
    const untouched = ["t-ete"];
    assert.equal(
      tags.mergeTagValue(untouched, ["t-social"], "t-brand"),
      untouched
    );
    assert.equal(
      tags.mergeTagValue("t-social", ["t-social"], "t-brand"),
      "t-brand"
    );
    assert.deepEqual(
      tags
        .catalogAfterMerge(
          catalog,
          ["t-social", "t-print", "t-brand"],
          "t-brand"
        )
        .map((tag) => tag.id),
      ["t-brand", "t-ete"]
    );
  });

  test("deleting a tag removes it from records and the catalog", () => {
    assert.deepEqual(tags.removeTagValue(["t-brand", "t-print"], "t-print"), [
      "t-brand",
    ]);
    assert.equal(tags.removeTagValue("t-print", "t-print"), null);
    const untouched = ["t-brand"];
    assert.equal(tags.removeTagValue(untouched, "t-print"), untouched);
    assert.deepEqual(
      tags.catalogAfterRemove(catalog, "t-print").map((tag) => tag.id),
      ["t-brand", "t-social", "t-ete"]
    );
  });

  test("renaming and recoloring update one tag; a null color clears it", () => {
    const renamed = tags.catalogAfterUpdate(catalog, "t-brand", {
      name: "  Brand   kit ",
    });
    assert.deepEqual(renamed[0], {
      id: "t-brand",
      name: "Brand kit",
      color: "blue",
    });
    assert.equal(renamed[1], catalog[1]);
    assert.deepEqual(
      tags.catalogAfterUpdate(catalog, "t-social", { color: "green" })[1],
      { id: "t-social", name: "Social", color: "green" }
    );
    assert.deepEqual(
      tags.catalogAfterUpdate(catalog, "t-print", { color: null })[2],
      { id: "t-print", name: "Print" }
    );
  });

  test("usage counts come from one aggregate request grouped by tag", () => {
    assert.deepEqual(tags.tagUsageRequest("tags", "fr"), {
      search: "",
      filters: {},
      advancedFilters: [],
      advancedFilterJoin: "and",
      calculations: {},
      locale: "fr",
      groupBy: [{ columnId: "tags" }],
      metrics: [{ fn: "count" }],
    });
    assert.deepEqual(
      tags.tagUsageCounts({
        groups: [
          { keys: ["t-brand"], values: [3] },
          { keys: [null], values: [9] },
          { keys: ["t-print"], values: ["2"] },
          { keys: ["t-brand"], values: [1] },
          { keys: ["broken"], values: [] },
        ],
      }),
      { "t-brand": 4, "t-print": 2 }
    );
    assert.equal(tags.tagUsageCounts({ results: {} }), undefined);
  });

  test("labels read in English or French and take the host's translations", () => {
    assert.equal(tags.tagLabels("en").addTags, "Add tags");
    assert.equal(tags.tagLabels("fr-FR").addTags, "Ajouter des étiquettes");
    const labels = tags.resolveTagLabels("en", (key) =>
      key === "tags.addTags" ? "Tag them" : key
    );
    assert.equal(labels.addTags, "Tag them");
    assert.equal(labels.removeTags, "Remove tags");
    assert.equal(
      tags.formatTagLabel(labels.create, { name: "Sale" }),
      "Create “Sale”"
    );
    assert.equal(
      tags.countTagLabel(labels.usageOne, labels.usageMany, 1),
      "1 record"
    );
    assert.equal(
      tags.countTagLabel(labels.usageOne, labels.usageMany, 4),
      "4 records"
    );
  });

  test("a tag's own color tints its chip; palette names and CSS colors both work", () => {
    assert.equal(colors.tagColorValue("green"), "#16a34a");
    assert.equal(colors.tagColorValue("#abc"), "#abc");
    assert.equal(
      colors.tagColorValue("oklch(0.7 0.1 200)"),
      "oklch(0.7 0.1 200)"
    );
    assert.equal(colors.tagColorValue("var(--brand)"), "var(--brand)");
    assert.equal(colors.tagColorValue("red; background: url(x)"), undefined);
    assert.equal(colors.tagColorValue(undefined), undefined);
    assert.deepEqual(colors.tagAppearance("Print", true, undefined, "red"), {
      colored: true,
      className: "yayaw-tag-tinted",
      style: { "--yayaw-tag-color": "#dc2626" },
    });
    assert.deepEqual(colors.tagAppearance("Print", false, undefined, "red"), {
      colored: false,
    });
    // Without a color of its own, the stored value keeps its automatic hue.
    assert.deepEqual(
      colors.tagAppearance("t-print", true, undefined, "not a color"),
      colors.tagAppearance("t-print", true)
    );
    assert.equal(colors.tagSwatchColor("x", true, "blue"), "#2563eb");
    assert.match(colors.tagSwatchColor("x") ?? "", AUTOMATIC_HUE);
    assert.equal(colors.tagSwatchColor("x", false, "blue"), undefined);
    assert.ok(colors.TAG_COLOR_NAMES.every(colors.isTagColorName));
  });
}
