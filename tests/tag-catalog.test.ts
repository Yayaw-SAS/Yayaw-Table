import { expect, it, test } from "bun:test";
import { readFileSync } from "node:fs";
import { QueryClient } from "@tanstack/react-query";
import {
  applyTagPatch,
  catalogAfterMerge,
  catalogAfterRemove,
  catalogAfterUpdate,
  catalogWithTag,
  countTagLabel,
  createTag,
  filterTags,
  findTagByName,
  formatTagLabel,
  isTagPatch,
  mergeTagValue,
  normalizeTagList,
  planTagBulkUpdate,
  removeTagValue,
  resolveTagColumn,
  resolveTagLabels,
  selectionTagUsage,
  tagCatalogQuery,
  tagCatalogQueryKey,
  tagColumnForField,
  tagColumnsOf,
  tagCreateName,
  tagLabels,
  tagPickerEnter,
  tagUsageCounts,
  tagUsageRequest,
  withTagCatalogOptions,
  withTagSelected,
} from "../src/components/ui/yayaw-table/utils/tag-catalog";
import {
  isTagColorName,
  TAG_COLOR_NAMES,
  tagAppearance,
  tagColorValue,
  tagSwatchColor,
} from "../src/components/ui/yayaw-table/utils/tag-colors";
import { tagCatalogSuite } from "./tag-catalog-suite";

tagCatalogSuite(
  test,
  {
    applyTagPatch,
    catalogAfterMerge,
    catalogAfterRemove,
    catalogAfterUpdate,
    catalogWithTag,
    countTagLabel,
    createTag,
    filterTags,
    findTagByName,
    formatTagLabel,
    isTagPatch,
    mergeTagValue,
    normalizeTagList,
    planTagBulkUpdate,
    removeTagValue,
    resolveTagColumn,
    resolveTagLabels,
    selectionTagUsage,
    tagCatalogQuery,
    tagCatalogQueryKey,
    tagColumnForField,
    tagColumnsOf,
    tagCreateName,
    tagLabels,
    tagPickerEnter,
    tagUsageCounts,
    tagUsageRequest,
    withTagCatalogOptions,
    withTagSelected,
  },
  {
    isTagColorName,
    TAG_COLOR_NAMES,
    tagAppearance,
    tagColorValue,
    tagSwatchColor,
  },
  () => new QueryClient()
);

it("ships the same tag catalog and colors in both standalone registries", () => {
  for (const file of ["tag-catalog.ts", "tag-colors.ts", "tag-colors.css"]) {
    expect(readFileSync(`packages/yayaw-table-vue/src/${file}`, "utf8")).toBe(
      readFileSync(`src/components/ui/yayaw-table/utils/${file}`, "utf8")
    );
  }
});
