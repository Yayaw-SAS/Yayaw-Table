import {
  compatibleListParams,
  matchesContractFilter,
} from "../src/components/ui/yayaw-table/utils/table-contracts";

/**
 * The "Assets" example shared by the React and Vue demos and the end-to-end
 * tests: folders and media files in one table, linked by `parentId`, with an
 * in-memory host that answers the file tree's `children`, `subtree` and
 * `tree-matches` scopes and its `tree.path`, `tree.move` and
 * `tree.createFolder` actions.
 */
export interface AssetRow {
  id: string;
  name: string;
  kind: "file" | "folder";
  parentId: string | null;
  size: number | null;
  updatedAt: string;
  mimeType: string;
  url: string;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const VIDEO =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const picture = (seed: string, width = 900, height = 600) =>
  `https://picsum.photos/seed/yayaw-${seed}/${width}/${height}`;

type Seed = [
  id: string,
  name: string,
  parentId: string | null,
  size?: number,
  mimeType?: string,
  url?: string,
  age?: number,
];

const SEEDS: Seed[] = [
  ["f-brand", "Brand", null],
  ["f-logos", "Logos", "f-brand"],
  [
    "logo-primary",
    "Logo primary.png",
    "f-logos",
    184_320,
    "image/png",
    picture("logo-primary"),
    2 * HOUR,
  ],
  [
    "logo-mono",
    "Logo mono.png",
    "f-logos",
    92_160,
    "image/png",
    picture("logo-mono"),
    DAY + HOUR,
  ],
  ["f-fonts", "Fonts", "f-brand"],
  [
    "fonts-zip",
    "Inter.zip",
    "f-fonts",
    3_400_000,
    "application/zip",
    "",
    12 * DAY,
  ],
  [
    "guidelines",
    "Brand guidelines.pdf",
    "f-brand",
    2_450_000,
    "application/pdf",
    "https://example.com/brief.pdf",
    3 * DAY,
  ],
  ["f-campaigns", "Campaigns", null],
  ["f-2026", "2026", "f-campaigns"],
  ["f-spring", "Spring launch", "f-2026"],
  [
    "hero",
    "Hero video.mp4",
    "f-spring",
    18_900_000,
    "video/mp4",
    VIDEO,
    5 * HOUR,
  ],
  [
    "banner-1",
    "Banner 1.jpg",
    "f-spring",
    512_000,
    "image/jpeg",
    picture("gallery-two"),
    DAY + 3 * HOUR,
  ],
  [
    "banner-2",
    "Banner 2.jpg",
    "f-spring",
    498_000,
    "image/jpeg",
    picture("gallery-three", 600, 900),
    DAY + 4 * HOUR,
  ],
  [
    "banner-10",
    "Banner 10.jpg",
    "f-spring",
    530_000,
    "image/jpeg",
    picture("banner-10"),
    2 * DAY,
  ],
  [
    "brief",
    "Campaign brief.pdf",
    "f-2026",
    860_000,
    "application/pdf",
    "https://example.com/brief.pdf",
    6 * DAY,
  ],
  ["f-photos", "Photos", null],
  [
    "team",
    "Team.jpg",
    "f-photos",
    1_200_000,
    "image/jpeg",
    picture("team"),
    20 * DAY,
  ],
  [
    "office",
    "Office.jpg",
    "f-photos",
    1_050_000,
    "image/jpeg",
    picture("office"),
    21 * DAY,
  ],
  [
    "workshop",
    "Workshop.jpg",
    "f-photos",
    980_000,
    "image/jpeg",
    picture("workshop"),
    22 * DAY,
  ],
  ["f-documents", "Documents", null],
  ["readme", "README.md", null, 4200, "text/markdown", "", 30 * 60_000],
  ["podcast", "Podcast intro.mp3", null, 5_600_000, "audio/mpeg", "", 9 * DAY],
  // Its folder was deleted: the tree shows it under "Unfiled" when it builds the tree itself.
  [
    "old-draft",
    "Old draft.docx",
    "f-archive",
    64_000,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "",
    40 * DAY,
  ],
];

/** Fresh records; dates are relative to now so "2 hours ago" stays true. */
export function assetRows(now = Date.now()): AssetRow[] {
  return SEEDS.map(([id, name, parentId, size, mimeType, url, age]) => ({
    id,
    name,
    kind: size === undefined ? "folder" : "file",
    parentId,
    size: size ?? null,
    updatedAt: new Date(now - (age ?? 7 * DAY)).toISOString(),
    mimeType: mimeType ?? "",
    url: url ?? "",
  }));
}

export const assetColumns = [
  { id: "name", header: "Name", type: "text" as const },
  {
    id: "kind",
    header: "Kind",
    type: "select" as const,
    options: [
      { value: "folder", label: "Folder" },
      { value: "file", label: "File" },
    ],
  },
  { id: "size", header: "Size", type: "number" as const },
  { id: "updatedAt", header: "Modified", type: "date" as const },
  { id: "mimeType", header: "Type", type: "text" as const },
  { id: "url", header: "URL", type: "text" as const },
  { id: "parentId", header: "Folder", type: "text" as const },
];

export const assetVisibleColumns = ["name", "kind", "size", "updatedAt"];

export const assetTableOptions = {
  syncUrl: true,
  enableAdvancedFilters: true,
  enableRowSelection: true,
  defaultDisplayMode: "filetree" as const,
  displayModes: ["filetree", "gallery", "table"] as (
    | "filetree"
    | "gallery"
    | "table"
  )[],
  // The facet panel (closed at first, the toolbar opens it): folders (the
  // parent column) and kinds, counted from the rows `list` returns (this
  // host has no `aggregate`).
  facets: { columns: ["parentId", "kind"], defaultOpen: false },
  gallery: {
    titleColumn: "name",
    cardColumnIds: ["size", "updatedAt"],
    imageColumn: "url",
    imageFit: "cover" as const,
    media: {
      enabled: true,
      urlColumn: "url",
      mimeTypeColumn: "mimeType",
      hoverPreview: true,
    },
  },
  filetree: {
    parentColumn: "parentId",
    kindColumn: "kind",
    nameColumn: "name",
    sizeColumn: "size",
    updatedColumn: "updatedAt",
    detailFields: ["mimeType"],
    rootLabel: "Assets",
  },
};

export interface AssetRequest {
  scope?: string;
  parentId?: string | null;
}

type Params = Record<string, unknown>;

const collator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

function sortAssets(rows: AssetRow[], sorting: unknown[]): AssetRow[] {
  const sort = sorting.find(
    (item): item is { id: keyof AssetRow; desc?: boolean } =>
      typeof (item as { id?: unknown })?.id === "string"
  );
  const direction = sort?.desc ? -1 : 1;
  const key = sort?.id ?? "name";
  return [...rows].sort((left, right) => {
    const folders =
      Number(right.kind === "folder") - Number(left.kind === "folder");
    if (folders) {
      return folders;
    }
    const a = left[key];
    const b = right[key];
    if (typeof a === "number" && typeof b === "number") {
      return (a - b) * direction;
    }
    return collator.compare(String(a ?? ""), String(b ?? "")) * direction;
  });
}

function matchesQuery(row: AssetRow, params: Params): boolean {
  const query = String(params.search ?? "")
    .trim()
    .toLocaleLowerCase();
  if (query && !row.name.toLocaleLowerCase().includes(query)) {
    return false;
  }
  const rules = params.advancedFilters as Params[];
  if (!rules.length) {
    return true;
  }
  const matches = (rule: Params) =>
    matchesContractFilter(row[String(rule.columnId) as keyof AssetRow], rule);
  return params.advancedFilterJoin === "or"
    ? rules.some(matches)
    : rules.every(matches);
}

const copy = (rows: AssetRow[]) => rows.map((row) => ({ ...row }));

/**
 * In-memory host of the Assets example. With `scopes: false` the list
 * ignores the file tree's scopes, like a host that has not implemented them:
 * the tree then loads every row and builds itself in the browser.
 */
export function createAssetActions(
  options: { scopes?: boolean; log?: (request: AssetRequest) => void } = {}
) {
  const records = assetRows();
  const scopes = options.scopes !== false;
  let created = 0;
  const byId = (id: string | null | undefined) =>
    records.find((row) => row.id === id);
  const childrenOf = (id: string | null) =>
    records.filter((row) => row.parentId === id);
  const ancestorsOf = (id: string): AssetRow[] => {
    const chain: AssetRow[] = [];
    let parent = byId(byId(id)?.parentId);
    while (parent && !chain.includes(parent)) {
      chain.unshift(parent);
      parent = byId(parent.parentId);
    }
    return chain;
  };
  const descendantsOf = (id: string | null): AssetRow[] => {
    const found: AssetRow[] = [];
    let level = childrenOf(id);
    while (level.length) {
      found.push(...level);
      level = level.flatMap((row) => childrenOf(row.id));
    }
    return found;
  };
  const folderMeta = (rows: AssetRow[]) => {
    const folders = rows.filter((row) => row.kind === "folder");
    return {
      childCounts: Object.fromEntries(
        folders.map((row) => [row.id, childrenOf(row.id).length])
      ),
      sizes: Object.fromEntries(
        folders.map((row) => [
          row.id,
          descendantsOf(row.id).reduce(
            (sum, item) => sum + (item.size ?? 0),
            0
          ),
        ])
      ),
    };
  };
  const nameTaken = (parentId: string | null, name: string, except?: string) =>
    childrenOf(parentId).some(
      (row) =>
        row.id !== except &&
        row.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    );
  const page = (rows: AssetRow[], params: Params) => {
    const size = Number(params.pageSize) || rows.length || 1;
    const number = Number(params.page) || 1;
    return {
      data: copy(rows.slice((number - 1) * size, number * size)),
      pageCount: Math.max(1, Math.ceil(rows.length / size)),
      totalCount: rows.length,
    };
  };
  const scoped = (scope: Params, params: Params) => {
    const parentId = (scope.parentId as string | null | undefined) ?? null;
    if (scope.kind === "children") {
      const rows = sortAssets(
        childrenOf(parentId),
        params.sorting as unknown[]
      );
      const result = page(rows, params);
      return {
        data: result.data,
        meta: {
          scope: "applied",
          pageCount: result.pageCount,
          totalCount: result.totalCount,
          ...folderMeta(rows),
        },
      };
    }
    if (scope.kind === "subtree") {
      const rows = descendantsOf(parentId);
      return {
        data: copy(rows),
        meta: {
          scope: "applied",
          totalCount: rows.length,
          truncated: false,
          ...folderMeta(rows),
        },
      };
    }
    const matches = records.filter((row) => matchesQuery(row, params));
    const ids = new Set(matches.map((row) => row.id));
    const ancestors = [
      ...new Map(
        matches
          .flatMap((row) => ancestorsOf(row.id))
          .filter((row) => !ids.has(row.id))
          .map((row) => [row.id, row])
      ).values(),
    ];
    return {
      data: copy(matches),
      meta: {
        scope: "applied",
        totalCount: matches.length,
        ancestors: copy(ancestors),
      },
    };
  };
  const moveOne = (id: string, parentId: string | null): string | undefined => {
    const row = byId(id);
    if (!row) {
      return "This item no longer exists.";
    }
    if (
      parentId &&
      (parentId === id || ancestorsOf(parentId).some((item) => item.id === id))
    ) {
      return "You can't move a folder into itself";
    }
    if (nameTaken(parentId, row.name, id)) {
      return `An item named “${row.name}” already exists there.`;
    }
    row.parentId = parentId;
    row.updatedAt = new Date().toISOString();
  };
  return {
    list: (input: Params) => {
      const params = compatibleListParams(input);
      const scope = input.scope as Params | undefined;
      options.log?.({
        scope: scope?.kind as string | undefined,
        parentId: scope?.parentId as string | null | undefined,
      });
      if (
        scope &&
        scopes &&
        ["children", "subtree", "tree-matches"].includes(String(scope.kind))
      ) {
        return Promise.resolve(scoped(scope, params));
      }
      const rows = sortAssets(
        records.filter((row) => matchesQuery(row, params)),
        params.sorting as unknown[]
      );
      const result = page(rows, params);
      return Promise.resolve({
        data: result.data,
        meta: { pageCount: result.pageCount, totalCount: result.totalCount },
      });
    },
    create: (values: Params) => {
      created += 1;
      const parentId = (values.parentId as string | null | undefined) ?? null;
      const name = String(values.name ?? "Untitled");
      if (nameTaken(parentId, name)) {
        return Promise.resolve({
          success: false,
          error: `An item named “${name}” already exists here.`,
        });
      }
      const row: AssetRow = {
        id: `new-${created}`,
        name,
        kind: values.kind === "folder" ? "folder" : "file",
        parentId,
        size: values.kind === "folder" ? null : Number(values.size ?? 0),
        updatedAt: new Date().toISOString(),
        mimeType: String(values.mimeType ?? ""),
        url: String(values.url ?? ""),
      };
      records.push(row);
      return Promise.resolve({ success: true, data: { ...row } });
    },
    update: (id: string, patch: Params) => {
      const row = byId(id);
      if (!row) {
        return Promise.resolve({
          success: false,
          error: "This item no longer exists.",
        });
      }
      if ("parentId" in patch) {
        const error = moveOne(id, (patch.parentId as string | null) ?? null);
        if (error) {
          return Promise.resolve({ success: false, error });
        }
      }
      if (
        typeof patch.name === "string" &&
        nameTaken(row.parentId, patch.name, id)
      ) {
        return Promise.resolve({
          success: false,
          error: `An item named “${patch.name}” already exists here.`,
        });
      }
      Object.assign(row, patch, { updatedAt: new Date().toISOString() });
      return Promise.resolve({ success: true, data: { ...row } });
    },
    delete: (id: string) => {
      const row = byId(id);
      if (row && childrenOf(id).length) {
        return Promise.resolve({
          success: false,
          error: `“${row.name}” is not empty. Move or delete its content first.`,
        });
      }
      const index = records.findIndex((item) => item.id === id);
      if (index >= 0) {
        records.splice(index, 1);
      }
      return Promise.resolve({ success: index >= 0 });
    },
    tree: {
      path: (id: string) => Promise.resolve(copy(ancestorsOf(id))),
      move: ({ ids, parentId }: { ids: string[]; parentId: string | null }) => {
        const failed: { id: string; error: string }[] = [];
        const moved: string[] = [];
        for (const id of ids) {
          const error = moveOne(id, parentId);
          if (error) {
            failed.push({ id, error });
          } else {
            moved.push(id);
          }
        }
        return Promise.resolve({ moved, failed });
      },
      createFolder: ({
        parentId,
        name,
      }: {
        parentId: string | null;
        name: string;
      }) => {
        let unique = name;
        for (let copyNumber = 2; nameTaken(parentId, unique); copyNumber += 1) {
          unique = `${name} ${copyNumber}`;
        }
        created += 1;
        const row: AssetRow = {
          id: `folder-${created}`,
          name: unique,
          kind: "folder",
          parentId,
          size: null,
          updatedAt: new Date().toISOString(),
          mimeType: "",
          url: "",
        };
        records.push(row);
        return Promise.resolve({ ...row });
      },
    },
  };
}
