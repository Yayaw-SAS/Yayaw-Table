/**
 * Host tag catalogs. A column opts in with `tags: true` (or a
 * `TagColumnConfig`): with `actions.tags`, its options come from the host's
 * catalog, loaded once per table and cached; pickers create tags on the fly,
 * bulk "Add tags" and "Remove tags" patch the selection and "Manage tags"
 * renames, recolors, merges and deletes them. Records store tag ids (strings).
 * Without `actions.tags` the column keeps its static `options`.
 *
 * Framework-free, shared by both editions and safe on a server.
 */

type MaybePromise<T> = Promise<T> | T;

/** One tag of a catalog. Records store its `id`. */
export interface TableTag {
  id: string;
  name: string;
  /** A palette name (`"green"`, see `TAG_COLOR_NAMES`) or any CSS color. */
  color?: string;
}

/** Which catalog a tag action works on. */
export interface TableTagScope {
  tableId: string;
  tableType: string;
  columnId: string;
}

/**
 * What a tag action may answer: the value itself, or `{ success, data?,
 * error? }` like the other table actions (Next.js server actions). A thrown
 * error or `success: false` shows `error` to the user.
 */
export type TableTagAnswer<T> =
  | T
  | { success: boolean; data?: T; error?: string };

export interface TableTagCreateInput extends TableTagScope {
  name: string;
  color?: string;
}

export interface TableTagUpdateInput extends TableTagScope {
  id: string;
  name?: string;
  /** A new color; `null` removes it (the tag takes its automatic color). */
  color?: string | null;
}

export interface TableTagMergeInput extends TableTagScope {
  sourceIds: string[];
  targetId: string;
}

export interface TableTagRemoveInput extends TableTagScope {
  id: string;
}

/**
 * `actions.tags`: the host's tag catalog. Only `list` is required; each
 * other action enables its part of the interface.
 */
export interface TableTagActions {
  /** Every tag of the column's catalog. */
  list: (scope: TableTagScope) => MaybePromise<TableTagAnswer<TableTag[]>>;
  /** Create a tag and answer it with its id; pickers select it at once. */
  create?: (
    input: TableTagCreateInput
  ) => MaybePromise<TableTagAnswer<TableTag>>;
  /** Rename or recolor a tag. */
  update?: (input: TableTagUpdateInput) => unknown;
  /** Put the target tag in place of the source tags in every record, then delete the sources. */
  merge?: (input: TableTagMergeInput) => unknown;
  /** Delete a tag from the catalog and from every record. */
  remove?: (input: TableTagRemoveInput) => unknown;
}

export type TagBulkMode = "patch" | "values";

/** `tags` on a column definition: `true`, or these settings. */
export interface TagColumnConfig {
  /** Offer "Create “name”" in pickers (needs `actions.tags.create`); default true. */
  create?: boolean;
  /** Offer "Manage tags" for this column (needs `update`, `merge` or `remove`); default true. */
  manage?: boolean;
  /**
   * What bulk "Add tags" and "Remove tags" send to `bulkUpdate`: `"values"`
   * (default) the resulting list of the rows, one call per distinct result;
   * `"patch"` one call with `{ [field]: { add, remove } }` for every selected
   * row (`applyTagPatch()` applies it on the server).
   */
  bulk?: TagBulkMode;
}

export type TagColumnInput = boolean | TagColumnConfig;

/** A column read as a tags column. */
export interface ResolvedTagColumn {
  columnId: string;
  /** Record field holding the tags: `inlineEdit.formField`, `accessorKey`, else the id. */
  field: string;
  /** `multiSelect` columns hold a list of ids; `select` and `tag` columns one id. */
  multiple: boolean;
  create: boolean;
  manage: boolean;
  bulk: TagBulkMode;
}

interface TagColumnLike {
  id: string;
  type?: string;
  tags?: unknown;
  accessorKey?: unknown;
  inlineEdit?: unknown;
}

const SINGLE_TAG_TYPES = new Set(["select", "tag"]);
const TAG_COLUMN_TYPES = new Set(["select", "tag", "multiSelect"]);

const recordOf = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** The column as a tags column, or undefined when it has no `tags`. */
export function resolveTagColumn(
  column: TagColumnLike
): ResolvedTagColumn | undefined {
  if (!column.tags || column.id === "select" || column.id === "actions") {
    return;
  }
  const settings = recordOf(column.tags);
  const formField = recordOf(column.inlineEdit).formField;
  let field = column.id;
  if (typeof formField === "string" && formField) {
    field = formField;
  } else if (typeof column.accessorKey === "string" && column.accessorKey) {
    field = column.accessorKey;
  }
  return {
    columnId: column.id,
    field,
    multiple: !SINGLE_TAG_TYPES.has(String(column.type ?? "")),
    create: settings.create !== false,
    manage: settings.manage !== false,
    bulk: settings.bulk === "patch" ? "patch" : "values",
  };
}

/** Every tags column of a table, in column order. */
export function tagColumnsOf(
  columns: readonly TagColumnLike[] | undefined
): ResolvedTagColumn[] {
  return (columns ?? []).flatMap((column) => {
    const resolved = resolveTagColumn(column);
    return resolved ? [resolved] : [];
  });
}

/** The tags column a form field edits, found by the record field it writes. */
export function tagColumnForField(
  columns: readonly ResolvedTagColumn[],
  fieldName: string
): ResolvedTagColumn | undefined {
  return (
    columns.find((column) => column.field === fieldName) ??
    columns.find((column) => column.columnId === fieldName)
  );
}

/** The query key both editions cache a catalog under. */
export const tagCatalogQueryKey = (scope: TableTagScope) =>
  [
    "yayaw-table",
    scope.tableId,
    "tags",
    scope.tableType,
    scope.columnId,
  ] as const;

/** How long a loaded catalog stays fresh before the next use reloads it. */
export const TAG_CATALOG_STALE_MS = 5 * 60_000;

// Answers ------------------------------------------------------------------------

const isAnswerEnvelope = (
  value: unknown
): value is { success: boolean; data?: unknown; error?: string } =>
  Boolean(value) &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  typeof (value as { success?: unknown }).success === "boolean";

/**
 * The value of a tag action's answer. Throws the answer's `error` (or
 * `fallback`) when it says `success: false`.
 */
export function tagAnswerValue<T>(
  answer: TableTagAnswer<T> | unknown,
  fallback: string
): T | undefined {
  if (isAnswerEnvelope(answer)) {
    if (!answer.success) {
      throw new Error(answer.error || fallback);
    }
    return answer.data as T | undefined;
  }
  return answer as T | undefined;
}

/** One tag from an answer: an id and a name, trimmed; undefined when invalid. */
export function normalizeTag(value: unknown): TableTag | undefined {
  const record = recordOf(value);
  const id = record.id;
  if (!(typeof id === "string" || typeof id === "number")) {
    return;
  }
  const name =
    typeof record.name === "string" && record.name.trim()
      ? record.name.trim()
      : String(id);
  const color =
    typeof record.color === "string" && record.color.trim()
      ? record.color.trim()
      : undefined;
  return color ? { id: String(id), name, color } : { id: String(id), name };
}

/** A `list` answer as a catalog: valid tags, the first of each id, in order. */
export function normalizeTagList(answer: unknown): TableTag[] {
  const value = tagAnswerValue<unknown[]>(answer, "Tags could not be loaded.");
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const tags: TableTag[] = [];
  for (const item of value) {
    const tag = normalizeTag(item);
    if (tag && !seen.has(tag.id)) {
      seen.add(tag.id);
      tags.push(tag);
    }
  }
  return tags;
}

/**
 * The query both editions load a catalog with (TanStack Query options):
 * loaded when a table with the column mounts, then shared by every picker,
 * filter and instance of the table until it is stale or invalidated.
 */
export function tagCatalogQuery(
  actions: Pick<TableTagActions, "list">,
  scope: TableTagScope
) {
  return {
    queryKey: tagCatalogQueryKey(scope),
    queryFn: async (): Promise<TableTag[]> =>
      normalizeTagList(await actions.list({ ...scope })),
    staleTime: TAG_CATALOG_STALE_MS,
  };
}

/** Runs a tag action and reads its answer (see `TableTagAnswer`). */
export async function callTagAction<T>(
  run: () => unknown,
  fallback: string
): Promise<T | undefined> {
  return tagAnswerValue<T>(await run(), fallback);
}

/**
 * Creates a tag named `name` (cleaned): the tag the host answers, or the
 * existing tag of that name without calling the host.
 */
export async function createTag(input: {
  actions: Pick<TableTagActions, "create">;
  scope: TableTagScope;
  tags: readonly TableTag[];
  name: string;
  color?: string;
}): Promise<{ tag: TableTag; created: boolean }> {
  const name = cleanTagName(input.name);
  const existing = findTagByName(input.tags, name);
  if (existing) {
    return { tag: existing, created: false };
  }
  const create = input.actions.create;
  if (!(name && create)) {
    throw new Error("Tags cannot be created here.");
  }
  const answer = await callTagAction<unknown>(
    () =>
      create({
        ...input.scope,
        name,
        ...(input.color ? { color: input.color } : {}),
      }),
    "The tag could not be created."
  );
  const tag = normalizeTag(answer);
  if (!tag) {
    throw new Error("The new tag has no id.");
  }
  return { tag, created: true };
}

// Options --------------------------------------------------------------------------

export interface TagOption {
  value: string;
  label: string;
  color?: string;
}

/** A catalog as column options: the id is the value, the name the label. */
export function tagOptions(tags: readonly TableTag[]): TagOption[] {
  return tags.map((tag) =>
    tag.color
      ? { value: tag.id, label: tag.name, color: tag.color }
      : { value: tag.id, label: tag.name }
  );
}

/**
 * Column definitions whose tags columns take their options from the loaded
 * catalogs (by column id). Columns without a loaded catalog keep their static
 * options. Tags columns read as `multiSelect` unless they are `select` or
 * `tag`, and show as tags. Returns `definitions` itself when nothing changes.
 */
export function withTagCatalogOptions<T extends TagColumnLike>(
  definitions: readonly T[],
  catalogs: Readonly<Record<string, readonly TableTag[] | undefined>>
): T[] {
  let changed = false;
  const next = definitions.map((column) => {
    const catalog = resolveTagColumn(column) ? catalogs[column.id] : undefined;
    if (!catalog) {
      return column;
    }
    changed = true;
    return {
      ...column,
      type: TAG_COLUMN_TYPES.has(String(column.type ?? ""))
        ? column.type
        : "multiSelect",
      displayVariant: "tag",
      options: tagOptions(catalog),
    };
  });
  return changed ? next : (definitions as T[]);
}

// Values ---------------------------------------------------------------------------

/** A record's value as a list of tag ids: strings, without blanks or repeats. */
export function tagIdsOf(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value];
  const ids: string[] = [];
  for (const item of items) {
    if (item === null || item === undefined || item === "") {
      continue;
    }
    const id = String(item);
    if (!ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

/** Tag ids back in the column's shape: a list, or one id (`null` when none). */
export function tagValueOf(ids: readonly string[], multiple: boolean): unknown {
  if (multiple) {
    return [...ids];
  }
  return ids.at(0) ?? null;
}

/** A value with one more tag selected: added to a list, or the single tag. */
export function withTagSelected(
  value: unknown,
  id: string,
  multiple: boolean
): unknown {
  if (!multiple) {
    return id;
  }
  const ids = tagIdsOf(value);
  return ids.includes(id) ? ids : [...ids, id];
}

// Search and create on the fly -------------------------------------------------------

const SPACES = /\s+/g;
const DIACRITICS = /\p{Diacritic}/gu;
const PLACEHOLDER = /\{(\w+)\}/g;

/** A name as users mean it: trimmed, single spaces. */
export const cleanTagName = (name: string): string =>
  name.trim().replace(SPACES, " ");

/** Names compare without case, accents or extra spaces. */
export const tagNameKey = (name: string): string =>
  cleanTagName(name)
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLocaleLowerCase();

/** The tag named `name`, compared without case, accents or extra spaces. */
export function findTagByName(
  tags: readonly TableTag[],
  name: string
): TableTag | undefined {
  const key = tagNameKey(name);
  return key ? tags.find((tag) => tagNameKey(tag.name) === key) : undefined;
}

/**
 * Tags whose name contains the query (without case or accents), the ones
 * that start with it first; every tag for an empty query.
 */
export function filterTags(
  tags: readonly TableTag[],
  query: string
): TableTag[] {
  const key = tagNameKey(query);
  if (!key) {
    return [...tags];
  }
  const starting: TableTag[] = [];
  const containing: TableTag[] = [];
  for (const tag of tags) {
    const name = tagNameKey(tag.name);
    if (name.startsWith(key)) {
      starting.push(tag);
    } else if (name.includes(key)) {
      containing.push(tag);
    }
  }
  return [...starting, ...containing];
}

/**
 * The name "Create “…”" offers for a query: the cleaned query, unless it is
 * empty or names an existing tag.
 */
export function tagCreateName(
  query: string,
  tags: readonly TableTag[]
): string | undefined {
  const name = cleanTagName(query);
  return name && !findTagByName(tags, name) ? name : undefined;
}

/**
 * What Enter does in a tag picker: the list picks its highlighted item only
 * after typing or moving in it (`"highlighted"`); otherwise a typed name is
 * picked, or created (`"typed"`); otherwise the picker is done: a cell saves,
 * a field closes its list (`"done"`).
 */
export function tagPickerEnter(input: {
  query: string;
  navigated: boolean;
  highlighted: boolean;
}): "done" | "highlighted" | "typed" {
  const typed = input.query.trim() !== "";
  if (input.highlighted && (typed || input.navigated)) {
    return "highlighted";
  }
  return typed ? "typed" : "done";
}

/** The value of the "Create “…”" item in pickers, never a tag id. */
export const TAG_CREATE_ITEM = "__yayaw-create-tag__";

// Bulk add and remove ----------------------------------------------------------------

/** What bulk "Add tags" or "Remove tags" does to each selected record. */
export interface TagPatch {
  add?: readonly string[];
  remove?: readonly string[];
}

/** Whether a value is the `{ add, remove }` patch of `"patch"` bulk mode. */
export function isTagPatch(value: unknown): value is TagPatch {
  const keys = Object.keys(recordOf(value));
  return (
    keys.length > 0 && keys.every((key) => key === "add" || key === "remove")
  );
}

/**
 * A record's tags after a patch: the removed ids go, then the added ones join
 * at the end (an id in both is kept). Hosts call it in `bulkUpdate` for
 * `"patch"` columns: `row.tags = applyTagPatch(row.tags, patch.tags)`.
 */
export function applyTagPatch(current: unknown, patch: TagPatch): string[] {
  const removed = new Set(tagIdsOf(patch.remove ?? []));
  const next = tagIdsOf(current).filter((id) => !removed.has(id));
  for (const id of tagIdsOf(patch.add ?? [])) {
    if (!next.includes(id)) {
      next.push(id);
    }
  }
  return next;
}

export interface TagBulkRow {
  id: string;
  /** The record's current value of the tags field. */
  value: unknown;
}

export interface TagBulkPlan {
  /** One `bulkUpdate(ids, patch)` call each, in order. */
  calls: { ids: string[]; patch: Record<string, unknown> }[];
  /** Each targeted row's tags once the calls succeed (optimistic update). */
  next: Record<string, string[]>;
  /** Selected rows the patch does not change. */
  unchanged: string[];
}

/**
 * The `bulkUpdate` calls of a bulk add or remove. `"values"` sends each group
 * of rows that end with the same tags their list (rows it does not change are
 * left out); `"patch"` sends `{ [field]: { add, remove } }` once, for every
 * row, so the server applies it to its current data.
 */
export function planTagBulkUpdate(input: {
  rows: readonly TagBulkRow[];
  field: string;
  patch: TagPatch;
  mode: TagBulkMode;
}): TagBulkPlan {
  const next: Record<string, string[]> = {};
  const unchanged: string[] = [];
  const groups = new Map<string, { ids: string[]; tags: string[] }>();
  for (const row of input.rows) {
    const current = tagIdsOf(row.value);
    const tags = applyTagPatch(current, input.patch);
    next[row.id] = tags;
    if (JSON.stringify(tags) === JSON.stringify(current)) {
      unchanged.push(row.id);
      continue;
    }
    const key = JSON.stringify(tags);
    const group = groups.get(key) ?? { ids: [], tags };
    group.ids.push(row.id);
    groups.set(key, group);
  }
  if (input.mode === "patch") {
    const ids = input.rows.map((row) => row.id);
    return {
      calls: ids.length
        ? [
            {
              ids,
              patch: {
                [input.field]: {
                  add: tagIdsOf(input.patch.add ?? []),
                  remove: tagIdsOf(input.patch.remove ?? []),
                },
              },
            },
          ]
        : [],
      next,
      unchanged,
    };
  }
  return {
    calls: [...groups.values()].map((group) => ({
      ids: group.ids,
      patch: { [input.field]: group.tags },
    })),
    next,
    unchanged,
  };
}

/**
 * The tags used by selected rows, most used first (then catalog order), with
 * how many rows use each: what "Remove tags" offers.
 */
export function selectionTagUsage(
  values: readonly unknown[],
  tags: readonly TableTag[]
): { tag: TableTag; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    for (const id of tagIdsOf(value)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const order = new Map(tags.map((tag, index) => [tag.id, index]));
  return [...counts.entries()]
    .map(([id, count]) => ({
      tag: tags.find((tag) => tag.id === id) ?? { id, name: id },
      count,
    }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        (order.get(left.tag.id) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(right.tag.id) ?? Number.MAX_SAFE_INTEGER)
    );
}

// Catalog changes --------------------------------------------------------------------

/** The catalog with a new or updated tag (replaced in place by id, else appended). */
export function catalogWithTag(
  tags: readonly TableTag[],
  tag: TableTag
): TableTag[] {
  return tags.some((item) => item.id === tag.id)
    ? tags.map((item) => (item.id === tag.id ? tag : item))
    : [...tags, tag];
}

/** The catalog after `update`: the tag renamed or recolored (`color: null` removes it). */
export function catalogAfterUpdate(
  tags: readonly TableTag[],
  id: string,
  changes: { name?: string; color?: string | null }
): TableTag[] {
  return tags.map((tag) => {
    if (tag.id !== id) {
      return tag;
    }
    const name =
      changes.name === undefined ? tag.name : cleanTagName(changes.name);
    if (changes.color === undefined) {
      return { ...tag, name };
    }
    return changes.color
      ? { ...tag, name, color: changes.color }
      : { id, name };
  });
}

/** The catalog after `merge`: the sources are gone, the target stays. */
export function catalogAfterMerge(
  tags: readonly TableTag[],
  sourceIds: readonly string[],
  targetId: string
): TableTag[] {
  const sources = new Set(sourceIds.filter((id) => id !== targetId));
  return tags.filter((tag) => !sources.has(tag.id));
}

/** The catalog after `remove`. */
export function catalogAfterRemove(
  tags: readonly TableTag[],
  id: string
): TableTag[] {
  return tags.filter((tag) => tag.id !== id);
}

/**
 * A record's value after a merge, in the column's shape: the target in place
 * of the first source, the other sources dropped. Unchanged values are
 * returned as they are.
 */
export function mergeTagValue(
  value: unknown,
  sourceIds: readonly string[],
  targetId: string
): unknown {
  const sources = new Set(sourceIds);
  const ids = tagIdsOf(value);
  if (!ids.some((id) => sources.has(id))) {
    return value;
  }
  const next: string[] = [];
  for (const id of ids) {
    const replaced = sources.has(id) ? targetId : id;
    if (!next.includes(replaced)) {
      next.push(replaced);
    }
  }
  return tagValueOf(next, Array.isArray(value));
}

/** A record's value once a tag is deleted, in the column's shape. */
export function removeTagValue(value: unknown, id: string): unknown {
  const ids = tagIdsOf(value);
  if (!ids.includes(id)) {
    return value;
  }
  return tagValueOf(
    ids.filter((item) => item !== id),
    Array.isArray(value)
  );
}

// Usage counts -------------------------------------------------------------------------

/**
 * The `aggregate` request that counts the records of each tag in one call,
 * over every record: chart groups on the column (a list counts in each of its
 * tags' groups).
 */
export function tagUsageRequest(
  columnId: string,
  locale = "en"
): Record<string, unknown> {
  return {
    search: "",
    filters: {},
    advancedFilters: [],
    advancedFilterJoin: "and",
    calculations: {},
    locale,
    groupBy: [{ columnId }],
    metrics: [{ fn: "count" }],
  };
}

/** Records per tag id from an `aggregate` answer, or undefined without groups. */
export function tagUsageCounts(
  answer: unknown
): Record<string, number> | undefined {
  const groups = recordOf(answer).groups;
  if (!Array.isArray(groups)) {
    return;
  }
  const counts: Record<string, number> = {};
  for (const group of groups) {
    const { keys, values } = recordOf(group);
    const key = Array.isArray(keys) ? keys[0] : undefined;
    const count = Array.isArray(values) ? Number(values[0]) : Number.NaN;
    if (key !== null && key !== undefined && Number.isFinite(count)) {
      const id = String(key);
      counts[id] = (counts[id] ?? 0) + count;
    }
  }
  return counts;
}

// Labels --------------------------------------------------------------------------------

/** Words of the tag pickers, the bulk dialog and "Manage tags", in English and French. */
export const tagLabels = (locale = "en") =>
  locale.toLowerCase().startsWith("fr")
    ? {
        tags: "Étiquettes",
        addTags: "Ajouter des étiquettes",
        removeTags: "Retirer des étiquettes",
        manageTags: "Gérer les étiquettes",
        manageDescription:
          "Renommez, recolorez, fusionnez ou supprimez les étiquettes de « {column} ».",
        create: "Créer « {name} »",
        creating: "Création…",
        search: "Rechercher ou créer une étiquette…",
        searchOnly: "Rechercher une étiquette…",
        noTags: "Aucune étiquette",
        noMatch: "Aucune étiquette correspondante",
        loading: "Chargement des étiquettes…",
        loadError: "Les étiquettes n’ont pas pu être chargées.",
        retry: "Réessayer",
        column: "Colonne",
        addTitleOne: "Ajouter des étiquettes à 1 élément",
        addTitleMany: "Ajouter des étiquettes à {count} éléments",
        removeTitleOne: "Retirer des étiquettes de 1 élément",
        removeTitleMany: "Retirer des étiquettes de {count} éléments",
        chooseTags: "Choisissez les étiquettes",
        noSelectionTags: "Aucune étiquette sur ces éléments",
        add: "Ajouter",
        remove: "Retirer",
        cancel: "Annuler",
        close: "Fermer",
        saving: "Enregistrement…",
        addedOne: "Étiquettes ajoutées à 1 élément",
        addedMany: "Étiquettes ajoutées à {count} éléments",
        removedOne: "Étiquettes retirées de 1 élément",
        removedMany: "Étiquettes retirées de {count} éléments",
        bulkFailed:
          "{count} éléments n’ont pas pu être modifiés ; ils restent sélectionnés.",
        removeTag: "Retirer {name}",
        name: "Nom",
        renameTag: "Renommer {name}",
        color: "Couleur",
        colorOf: "Couleur de {name}",
        defaultColor: "Par défaut",
        colorGray: "Gris",
        colorBrown: "Marron",
        colorOrange: "Orange",
        colorYellow: "Jaune",
        colorGreen: "Vert",
        colorBlue: "Bleu",
        colorPurple: "Violet",
        colorPink: "Rose",
        colorRed: "Rouge",
        customColor: "Personnalisée",
        tagActions: "Actions de {name}",
        merge: "Fusionner dans…",
        mergeInto: "Fusionner « {name} » dans",
        mergeTitle: "Fusionner « {source} » dans « {target} » ?",
        mergeDescription:
          "Les éléments étiquetés « {source} » seront étiquetés « {target} », puis « {source} » sera supprimée.",
        mergeConfirm: "Fusionner",
        delete: "Supprimer",
        deleteTitle: "Supprimer « {name} » ?",
        deleteUsedOne:
          "Elle est utilisée par 1 élément, qui la perdra. Cette action est irréversible.",
        deleteUsedMany:
          "Elle est utilisée par {count} éléments, qui la perdront. Cette action est irréversible.",
        deleteUnused: "Aucun élément ne l’utilise.",
        deleteUnknown:
          "Les éléments qui l’utilisent la perdront. Cette action est irréversible.",
        usageNone: "Aucun élément",
        usageOne: "1 élément",
        usageMany: "{count} éléments",
        counting: "Comptage…",
        emptyName: "Saisissez un nom.",
        duplicateName: "Une étiquette « {name} » existe déjà.",
        saved: "Étiquette enregistrée",
        merged: "Étiquettes fusionnées",
        deleted: "Étiquette supprimée",
      }
    : {
        tags: "Tags",
        addTags: "Add tags",
        removeTags: "Remove tags",
        manageTags: "Manage tags",
        manageDescription:
          "Rename, recolor, merge or delete the tags of “{column}”.",
        create: "Create “{name}”",
        creating: "Creating…",
        search: "Search or create a tag…",
        searchOnly: "Search tags…",
        noTags: "No tags",
        noMatch: "No matching tags",
        loading: "Loading tags…",
        loadError: "Tags could not be loaded.",
        retry: "Retry",
        column: "Column",
        addTitleOne: "Add tags to 1 record",
        addTitleMany: "Add tags to {count} records",
        removeTitleOne: "Remove tags from 1 record",
        removeTitleMany: "Remove tags from {count} records",
        chooseTags: "Choose tags",
        noSelectionTags: "These records have no tags",
        add: "Add",
        remove: "Remove",
        cancel: "Cancel",
        close: "Close",
        saving: "Saving…",
        addedOne: "Tags added to 1 record",
        addedMany: "Tags added to {count} records",
        removedOne: "Tags removed from 1 record",
        removedMany: "Tags removed from {count} records",
        bulkFailed:
          "{count} records could not be updated; they remain selected.",
        removeTag: "Remove {name}",
        name: "Name",
        renameTag: "Rename {name}",
        color: "Color",
        colorOf: "Color of {name}",
        defaultColor: "Default",
        colorGray: "Gray",
        colorBrown: "Brown",
        colorOrange: "Orange",
        colorYellow: "Yellow",
        colorGreen: "Green",
        colorBlue: "Blue",
        colorPurple: "Purple",
        colorPink: "Pink",
        colorRed: "Red",
        customColor: "Custom",
        tagActions: "{name} actions",
        merge: "Merge into…",
        mergeInto: "Merge “{name}” into",
        mergeTitle: "Merge “{source}” into “{target}”?",
        mergeDescription:
          "Records tagged “{source}” will be tagged “{target}”, then “{source}” will be deleted.",
        mergeConfirm: "Merge",
        delete: "Delete",
        deleteTitle: "Delete “{name}”?",
        deleteUsedOne:
          "It is used by 1 record, which will lose it. This cannot be undone.",
        deleteUsedMany:
          "It is used by {count} records, which will lose it. This cannot be undone.",
        deleteUnused: "No record uses it.",
        deleteUnknown:
          "Records that use it will lose it. This cannot be undone.",
        usageNone: "No records",
        usageOne: "1 record",
        usageMany: "{count} records",
        counting: "Counting…",
        emptyName: "Enter a name.",
        duplicateName: "A tag named “{name}” already exists.",
        saved: "Tag saved",
        merged: "Tags merged",
        deleted: "Tag deleted",
      };

export type TagLabels = ReturnType<typeof tagLabels>;

/**
 * The labels of `locale` with the host's translations: `tags.<key>` (Vue's
 * flat translations, or the value React's `t()` gives for that key).
 */
export function resolveTagLabels(
  locale: string | undefined,
  translate?: (key: string) => string | undefined
): TagLabels {
  const labels = tagLabels(locale);
  if (!translate) {
    return labels;
  }
  const resolved = { ...labels };
  for (const key of Object.keys(labels) as (keyof TagLabels)[]) {
    const value = translate(`tags.${key}`);
    if (typeof value === "string" && value && value !== `tags.${key}`) {
      resolved[key] = value;
    }
  }
  return resolved;
}

/** A label with its `{placeholders}` filled in. */
export function formatTagLabel(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(PLACEHOLDER, (match, key: string) =>
    key in values ? String(values[key]) : match
  );
}

/** "1 record" or "{count} records" from the one/many pair of a label. */
export function countTagLabel(
  one: string,
  many: string,
  count: number
): string {
  return count === 1 ? one : formatTagLabel(many, { count });
}
