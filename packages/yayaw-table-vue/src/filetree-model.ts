/**
 * File tree view model shared by the React and Vue editions.
 *
 * Pure functions only: settings, labels, building and flattening the tree,
 * folders-first natural sorting, orphans and cycles, move validation, the
 * keyboard state machine, search with ancestors, expanded-state serialization,
 * formats and windowing. The data controller lives in `filetree-controller.ts`.
 */
import {
  resolveGalleryMedia,
  type TableGalleryMediaConfig,
} from "./media-contract";
import { compatibleListParams } from "./table-contracts";
import { formatNumberValue, type NumberFormatConfig } from "./value-format";

type Row = Record<string, unknown>;

/** Id of the virtual folder holding records whose parent is unknown or cyclic. */
export const FILETREE_UNFILED = "__filetree_unfiled";
/** Key of the root in children maps. */
export const FILETREE_ROOT = "";
/** Row id of the root header, a drop target for moving items to the top level. */
export const FILETREE_ROOT_TARGET = "__filetree_root";
/** Children loaded per request; more show a "Show more" row. */
export const FILETREE_PAGE_SIZE = 200;
/** Nodes loaded at most by the client fallback and by "Expand all". */
export const FILETREE_MAX_NODES = 2000;
/** Indentation stops growing after this depth. */
export const FILETREE_MAX_INDENT = 8;
/** Expanded folders kept at most in a saved view. */
export const FILETREE_MAX_SAVED_EXPANDED = 500;
/** Hovering a folder this long while dragging expands it. */
export const FILETREE_HOVER_EXPAND_MS = 600;
/** Type-ahead letters typed within this delay form one search. */
export const FILETREE_TYPEAHEAD_MS = 700;
/** Row attribute read by pointer drags. */
export const FILETREE_ROW_ATTRIBUTE = "data-filetree-id";

export type FileTreeIconKind =
  | "folder"
  | "folder-open"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "archive"
  | "code"
  | "file";

export interface FileTreeSort {
  id: string;
  desc?: boolean;
}

/** Per-view settings, saved in views and in the `<tableId>-filetree` URL key. */
export interface FileTreeViewSettings {
  /** Column holding the id of the parent folder; empty for root items. */
  parentColumn?: string;
  /** Column holding `"folder"` or `"file"`. */
  kindColumn?: string;
  /** Column used as the node label; defaults to the title column. */
  nameColumn?: string;
  /** Column holding sizes in bytes. */
  sizeColumn?: string;
  /** Column holding the last modification date. */
  updatedColumn?: string;
  /** Columns shown after Name; defaults to the size and updated columns. */
  columns?: string[];
  /** Show the details pane (desktop). */
  showDetails?: boolean;
  /** Extra properties listed in the details pane. */
  detailFields?: string[];
  /** Folders before files in every folder (default true). */
  foldersFirst?: boolean;
  /** Sort of every folder; defaults to the view's sort, then the name. */
  sort?: FileTreeSort;
  /** Folder levels opened on first load: 0, 1 or 2 (default 1). */
  defaultExpandedDepth?: number;
  /** Label of the root; defaults to the table's name. */
  rootLabel?: string;
  /** Folders open in this view. */
  expanded?: string[];
  /** Every folder open ("Expand all"). */
  expandedAll?: boolean;
}

export interface FileTreeMoveInput {
  ids: string[];
  parentId: string | null;
  beforeId?: string;
}

export interface FileTreeMoveResult {
  moved?: string[];
  failed?: { id: string; error?: string }[];
}

/** `actions.tree`: server operations of the file tree; each one has a fallback. */
export interface FileTreeActions {
  /** Ancestors of a node, root first (breadcrumbs, deep links). */
  path?: (id: string) => Promise<Row[]> | Row[];
  /** Move records in one batch; the server re-checks permissions, cycles and name clashes. */
  move?: (
    input: FileTreeMoveInput
  ) => Promise<FileTreeMoveResult> | FileTreeMoveResult;
  /** Create a folder and answer its record. */
  createFolder?: (input: {
    parentId: string | null;
    name: string;
  }) => Promise<Row> | Row;
}

export type FileTreeCustomIcon =
  | FileTreeIconKind
  | { src: string; alt?: string };

/** Host extension points. Runtime callbacks never enter saved views. */
export interface FileTreeHooks<TDetails = unknown> {
  isFolder?: (row: Row) => boolean;
  getIcon?: (row: Row) => FileTreeCustomIcon | undefined;
  /** Replace the details pane body (React node, or a Vue render result). */
  renderDetails?: (row: Row) => TDetails;
  /** Upload files dropped from the desktop onto a folder; the library ships no uploader. */
  onDropFiles?: (input: {
    parentId: string | null;
    files: File[];
  }) => Promise<unknown> | unknown;
  canMove?: (row: Row, target: Row | null) => boolean;
  canCreateFolder?: (parent: Row | null) => boolean;
  canRename?: (row: Row) => boolean;
}

/** `table.filetree`: defaults for every view plus the host hooks; `false` turns the mode off. */
export interface FileTreeTableConfig<TDetails = unknown>
  extends FileTreeViewSettings,
    FileTreeHooks<TDetails> {}

export interface ResolvedFileTreeSettings {
  parentColumn: string;
  kindColumn?: string;
  nameColumn: string;
  sizeColumn?: string;
  updatedColumn?: string;
  columns: string[];
  showDetails: boolean;
  detailFields: string[];
  foldersFirst: boolean;
  sort?: FileTreeSort;
  defaultExpandedDepth: number;
  rootLabel?: string;
  expanded: string[];
  expandedAll: boolean;
  /** The view or the table saved which folders are open (otherwise `defaultExpandedDepth` applies). */
  expandedSaved: boolean;
}

export interface FileTreeColumn {
  id: string;
  header?: string;
  type?: string;
  numberFormat?: unknown;
  options?: { value: unknown; label?: string }[];
}

const STRING_KEYS = [
  "parentColumn",
  "kindColumn",
  "nameColumn",
  "sizeColumn",
  "updatedColumn",
  "rootLabel",
] as const;
const BOOLEAN_KEYS = ["showDetails", "foldersFirst", "expandedAll"] as const;
const PARENT_COLUMN_IDS = [
  "parentid",
  "parent_id",
  "parent",
  "folderid",
  "folder_id",
  "folder",
];
const NAME_COLUMN_IDS = ["name", "title", "filename", "label"];
const MAX_DEPTH_SETTING = 2;

const cleanString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const cleanIds = (value: unknown, max = Number.POSITIVE_INFINITY) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((item): item is string | number =>
              ["string", "number"].includes(typeof item)
            )
            .map((item) => String(item).trim())
            .filter(Boolean)
        ),
      ].slice(0, max)
    : undefined;

function cleanSort(value: unknown): FileTreeSort | undefined {
  if (!value || typeof value !== "object") {
    return;
  }
  const id = cleanString((value as Row).id);
  if (!id) {
    return;
  }
  return (value as Row).desc === true ? { id, desc: true } : { id };
}

function cleanDepth(value: unknown): number | undefined {
  const depth = Number(value);
  if (value === undefined || value === null || !Number.isFinite(depth)) {
    return;
  }
  return Math.min(MAX_DEPTH_SETTING, Math.max(0, Math.trunc(depth)));
}

/** Keep only valid settings; host callbacks and unknown values are dropped. */
export function normalizeFileTreeViewConfig(
  value: unknown
): FileTreeViewSettings | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }
  const source = value as Row;
  const normalized: Record<string, unknown> = {};
  for (const key of STRING_KEYS) {
    const text = cleanString(source[key]);
    if (text) {
      normalized[key] = text;
    }
  }
  for (const key of BOOLEAN_KEYS) {
    if (typeof source[key] === "boolean") {
      normalized[key] = source[key];
    }
  }
  const columns = cleanIds(source.columns);
  if (columns) {
    normalized.columns = columns;
  }
  const detailFields = cleanIds(source.detailFields);
  if (detailFields) {
    normalized.detailFields = detailFields;
  }
  const expanded = cleanIds(source.expanded, FILETREE_MAX_SAVED_EXPANDED);
  if (expanded) {
    normalized.expanded = expanded;
  }
  const sort = cleanSort(source.sort);
  if (sort) {
    normalized.sort = sort;
  }
  const depth = cleanDepth(source.defaultExpandedDepth);
  if (depth !== undefined) {
    normalized.defaultExpandedDepth = depth;
  }
  return Object.keys(normalized).length
    ? (normalized as FileTreeViewSettings)
    : undefined;
}

const usableColumns = (columns: readonly FileTreeColumn[]) =>
  columns.filter(
    (column) =>
      column.id !== "select" &&
      column.id !== "actions" &&
      column.type !== "actions"
  );

/** A parent column recognised by its id (`parentId`, `parent_id`, `folderId`…). */
export function detectParentColumn(
  columns: readonly FileTreeColumn[]
): string | undefined {
  return usableColumns(columns).find((column) =>
    PARENT_COLUMN_IDS.includes(column.id.toLowerCase())
  )?.id;
}

/** The mode is offered when a parent column is configured or detectable, unless `table.filetree` is `false`. */
export function isFileTreeAvailable(
  config: unknown,
  columns: readonly FileTreeColumn[]
): boolean {
  if (config === false) {
    return false;
  }
  const settings =
    config && typeof config === "object"
      ? normalizeFileTreeViewConfig(config)
      : undefined;
  return Boolean(settings?.parentColumn ?? detectParentColumn(columns));
}

function defaultNameColumn(
  columns: readonly FileTreeColumn[],
  exclude: readonly (string | undefined)[]
): string {
  const candidates = usableColumns(columns).filter(
    (column) => !exclude.includes(column.id)
  );
  return (
    candidates.find((column) =>
      NAME_COLUMN_IDS.includes(column.id.toLowerCase())
    )?.id ??
    candidates.find((column) => (column.type ?? "text") === "text")?.id ??
    candidates[0]?.id ??
    "name"
  );
}

const pick = <T>(view: T | undefined, defaults: T | undefined, fallback: T) =>
  view ?? defaults ?? fallback;

/** Table defaults, then the view's own settings, then built-in defaults. */
export function resolveFileTreeSettings(
  columns: readonly FileTreeColumn[],
  defaults?: FileTreeViewSettings,
  view?: FileTreeViewSettings
): ResolvedFileTreeSettings {
  const base = normalizeFileTreeViewConfig(defaults) ?? {};
  const own = normalizeFileTreeViewConfig(view) ?? {};
  const merged: FileTreeViewSettings = { ...base, ...own };
  const parentColumn =
    merged.parentColumn ?? detectParentColumn(columns) ?? "parentId";
  const nameColumn =
    merged.nameColumn ??
    defaultNameColumn(columns, [parentColumn, merged.kindColumn]);
  const known = new Set(usableColumns(columns).map((column) => column.id));
  const columnIds =
    merged.columns ??
    [merged.sizeColumn, merged.updatedColumn].filter(
      (id): id is string => Boolean(id) && known.has(String(id))
    );
  return {
    parentColumn,
    kindColumn: merged.kindColumn,
    nameColumn,
    sizeColumn: merged.sizeColumn,
    updatedColumn: merged.updatedColumn,
    columns: columnIds.filter((id) => id !== nameColumn),
    showDetails: pick(own.showDetails, base.showDetails, false),
    detailFields: merged.detailFields ?? [],
    foldersFirst: pick(own.foldersFirst, base.foldersFirst, true),
    sort: merged.sort,
    defaultExpandedDepth: pick(
      own.defaultExpandedDepth,
      base.defaultExpandedDepth,
      1
    ),
    rootLabel: merged.rootLabel,
    expanded: own.expanded ?? base.expanded ?? [],
    expandedAll: pick(own.expandedAll, base.expandedAll, false),
    expandedSaved:
      own.expanded !== undefined ||
      own.expandedAll !== undefined ||
      base.expanded !== undefined ||
      base.expandedAll === true,
  };
}

// ---------------------------------------------------------------- labels

export type FileTreeLabelKey = keyof typeof EN_LABELS;

const EN_LABELS = {
  root: "All files",
  name: "Name",
  size: "Size",
  modified: "Modified",
  type: "Kind",
  path: "Location",
  newFolder: "New folder",
  newFolderName: "New folder",
  folderName: "Folder name",
  expandAll: "Expand all",
  collapseAll: "Collapse all",
  details: "Details",
  hideDetails: "Hide details",
  info: "Info",
  open: "Open",
  preview: "Preview",
  rename: "Rename",
  moveTo: "Move to…",
  moveHere: "Move here",
  delete: "Delete",
  cancel: "Cancel",
  create: "Create",
  back: "Back",
  actions: "Actions",
  selectRow: "Select",
  selectAll: "Select all",
  selected: "{count} selected",
  clearSelection: "Clear selection",
  unfiled: "Unfiled",
  showMore: "Show more ({count})",
  showMoreUnknown: "Show more",
  emptyFolder: "Empty folder",
  empty: "No files yet",
  noMatches: "No matching files",
  loading: "Loading…",
  loaded: "{count} items",
  folder: "Folder",
  file: "File",
  folders: "{count} folders",
  oneFolder: "1 folder",
  files: "{count} files",
  oneFile: "1 file",
  items: "{count} items",
  moved: "Moved {count} items to {path}",
  movedOne: "Moved “{name}” to {path}",
  moveFailed: "{count} items could not be moved",
  undo: "Undo",
  undone: "Move undone",
  cutReady: "{count} items cut. Paste into a folder with Ctrl+V.",
  created: "Folder “{name}” created",
  renamed: "Renamed to “{name}”",
  deleteTitle: "Delete {count} items?",
  deleteOneTitle: "Delete “{name}”?",
  deleteDescription: "This action cannot be undone.",
  deleted: "{count} items deleted",
  intoSelf: "You can't move a folder into itself",
  intoDescendant: "You can't move a folder into one of its subfolders",
  noPermission: "You don't have permission to move here",
  notAFolder: "Items can only go into folders",
  virtualFolder: "Items can't be moved into Unfiled",
  alreadyThere: "Already in this folder",
  moveItems: "Move {count} items to {path}",
  moveItem: "Move “{name}” to {path}",
  moveDialogTitle: "Move {count} items",
  moveOneDialogTitle: "Move “{name}”",
  searchFolders: "Search folders",
  truncated: "Showing the first {count} items. Narrow the search to see more.",
  expandedFirst: "Expanded the first {count} items",
  uploading: "Uploading {count} files…",
  settingsParent: "Parent column",
  settingsKind: "Kind column",
  settingsName: "Name column",
  settingsSize: "Size column",
  settingsUpdated: "Modified column",
  settingsColumns: "Columns",
  settingsDetails: "Details pane",
  settingsFoldersFirst: "Folders first",
  settingsDepth: "Open on load",
  columnsBoth: "Size and modified",
  columnsSize: "Size",
  columnsUpdated: "Modified",
  columnsNone: "Name only",
  depth0: "Top level only",
  depth1: "One level",
  depth2: "Two levels",
  none: "None",
  on: "On",
  off: "Off",
  justNow: "Just now",
  sortBy: "Sort by {name}",
  shortcuts: "Arrows move, Enter opens, F2 renames, Ctrl+X then Ctrl+V moves",
  expand: "Expand",
  collapse: "Collapse",
  close: "Close",
  resizeDetails: "Resize the details pane",
  noSelection: "Select an item to see its details",
  contents: "Items",
} as const;

const FR_LABELS: Record<FileTreeLabelKey, string> = {
  root: "Tous les fichiers",
  name: "Nom",
  size: "Taille",
  modified: "Modifié",
  type: "Nature",
  path: "Emplacement",
  newFolder: "Nouveau dossier",
  newFolderName: "Nouveau dossier",
  folderName: "Nom du dossier",
  expandAll: "Tout déplier",
  collapseAll: "Tout replier",
  details: "Détails",
  hideDetails: "Masquer les détails",
  info: "Infos",
  open: "Ouvrir",
  preview: "Aperçu",
  rename: "Renommer",
  moveTo: "Déplacer vers…",
  moveHere: "Déplacer ici",
  delete: "Supprimer",
  cancel: "Annuler",
  create: "Créer",
  back: "Retour",
  actions: "Actions",
  selectRow: "Sélectionner",
  selectAll: "Tout sélectionner",
  selected: "{count} sélectionnés",
  clearSelection: "Effacer la sélection",
  unfiled: "Non classés",
  showMore: "Afficher plus ({count})",
  showMoreUnknown: "Afficher plus",
  emptyFolder: "Dossier vide",
  empty: "Aucun fichier",
  noMatches: "Aucun fichier correspondant",
  loading: "Chargement…",
  loaded: "{count} éléments",
  folder: "Dossier",
  file: "Fichier",
  folders: "{count} dossiers",
  oneFolder: "1 dossier",
  files: "{count} fichiers",
  oneFile: "1 fichier",
  items: "{count} éléments",
  moved: "{count} éléments déplacés vers {path}",
  movedOne: "« {name} » déplacé vers {path}",
  moveFailed: "{count} éléments n'ont pas pu être déplacés",
  undo: "Annuler",
  undone: "Déplacement annulé",
  cutReady: "{count} éléments coupés. Collez-les dans un dossier avec Ctrl+V.",
  created: "Dossier « {name} » créé",
  renamed: "Renommé en « {name} »",
  deleteTitle: "Supprimer {count} éléments ?",
  deleteOneTitle: "Supprimer « {name} » ?",
  deleteDescription: "Cette action est irréversible.",
  deleted: "{count} éléments supprimés",
  intoSelf: "Impossible de déplacer un dossier dans lui-même",
  intoDescendant:
    "Impossible de déplacer un dossier dans l'un de ses sous-dossiers",
  noPermission: "Vous n'avez pas le droit de déplacer ici",
  notAFolder: "Les éléments ne peuvent aller que dans des dossiers",
  virtualFolder: "Impossible de déplacer des éléments dans Non classés",
  alreadyThere: "Déjà dans ce dossier",
  moveItems: "Déplacer {count} éléments vers {path}",
  moveItem: "Déplacer « {name} » vers {path}",
  moveDialogTitle: "Déplacer {count} éléments",
  moveOneDialogTitle: "Déplacer « {name} »",
  searchFolders: "Rechercher un dossier",
  truncated:
    "Affichage des {count} premiers éléments. Affinez la recherche pour en voir plus.",
  expandedFirst: "Les {count} premiers éléments ont été dépliés",
  uploading: "Envoi de {count} fichiers…",
  settingsParent: "Colonne parent",
  settingsKind: "Colonne de type",
  settingsName: "Colonne du nom",
  settingsSize: "Colonne de taille",
  settingsUpdated: "Colonne de modification",
  settingsColumns: "Colonnes",
  settingsDetails: "Volet de détails",
  settingsFoldersFirst: "Dossiers en premier",
  settingsDepth: "Ouvrir au chargement",
  columnsBoth: "Taille et modification",
  columnsSize: "Taille",
  columnsUpdated: "Modification",
  columnsNone: "Nom seulement",
  depth0: "Premier niveau seulement",
  depth1: "Un niveau",
  depth2: "Deux niveaux",
  none: "Aucune",
  on: "Oui",
  off: "Non",
  justNow: "À l'instant",
  sortBy: "Trier par {name}",
  shortcuts:
    "Flèches pour naviguer, Entrée pour ouvrir, F2 pour renommer, Ctrl+X puis Ctrl+V pour déplacer",
  expand: "Déplier",
  collapse: "Replier",
  close: "Fermer",
  resizeDetails: "Redimensionner le volet de détails",
  noSelection: "Sélectionnez un élément pour voir ses détails",
  contents: "Éléments",
};

export type FileTreeTranslate = (key: string, fallback: string) => string;

/** A label in the table's language; hosts override it with `filetree.<key>`. */
export function fileTreeLabel(
  key: FileTreeLabelKey,
  locale: string,
  translate?: FileTreeTranslate,
  params: Record<string, string | number> = {}
): string {
  const fallback = locale.toLowerCase().startsWith("fr")
    ? FR_LABELS[key]
    : EN_LABELS[key];
  const text = translate ? translate(key, fallback) : fallback;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

// ---------------------------------------------------------------- rows and kinds

export const rowIdOf = (row: Row): string => String(row.id ?? row._id ?? "");

/** The parent id stored in a row, or null for a root item. */
export function parentIdOf(row: Row, parentColumn: string): string | null {
  const value = row[parentColumn];
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "object") {
    const id = (value as Row).id ?? (value as Row)._id;
    return id === undefined || id === null || id === "" ? null : String(id);
  }
  return String(value);
}

/** Folder by kind column or host hook; without a kind, a node with children is a folder. */
export function isFolderRow(
  row: Row,
  settings: Pick<ResolvedFileTreeSettings, "kindColumn">,
  hooks?: Pick<FileTreeHooks, "isFolder">,
  hasChildren = false
): boolean {
  if (hooks?.isFolder?.(row)) {
    return true;
  }
  const kind = settings.kindColumn ? row[settings.kindColumn] : undefined;
  if (typeof kind === "string" && kind.trim()) {
    return kind.trim().toLowerCase() === "folder";
  }
  return hasChildren;
}

export const nameOf = (row: Row | undefined, nameColumn: string): string => {
  const value = row?.[nameColumn];
  return value === null || value === undefined ? "" : String(value);
};

const EXTENSION_KINDS: Record<string, FileTreeIconKind> = {};
for (const [kind, extensions] of [
  ["image", "png jpg jpeg gif webp svg avif heic bmp tif tiff ico"],
  ["video", "mp4 mov webm mkv avi m4v"],
  ["audio", "mp3 wav ogg flac m4a aac"],
  ["document", "pdf doc docx txt md rtf odt xls xlsx csv ppt pptx key pages"],
  ["archive", "zip rar 7z tar gz tgz bz2 xz"],
  [
    "code",
    "js ts tsx jsx json html css scss vue py rb go rs java php sh yml yaml xml sql",
  ],
] as const) {
  for (const extension of extensions.split(" ")) {
    EXTENSION_KINDS[extension] = kind;
  }
}
const EXTENSION_PATTERN = /\.([a-z0-9]+)$/i;
const ARCHIVE_MIME = /zip|compressed|tar|rar/;
const DOCUMENT_MIME = /pdf|document|msword|sheet|presentation|text\/plain/;
const CODE_MIME = /json|javascript|typescript|html|css|xml/;
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

function kindFromMime(mimeType: string): FileTreeIconKind | undefined {
  const mime = mimeType.toLowerCase();
  for (const kind of ["image", "video", "audio"] as const) {
    if (mime.startsWith(`${kind}/`)) {
      return kind;
    }
  }
  if (ARCHIVE_MIME.test(mime)) {
    return "archive";
  }
  if (DOCUMENT_MIME.test(mime)) {
    return "document";
  }
  if (CODE_MIME.test(mime)) {
    return "code";
  }
}

export interface FileTreeIcon {
  kind: FileTreeIconKind;
  src?: string;
  alt?: string;
}

/** Folder open/closed, the host's icon, or the file type from the media contract, MIME type or extension. */
export function fileTreeIcon(
  row: Row,
  options: {
    folder: boolean;
    expanded?: boolean;
    nameColumn: string;
    media?: TableGalleryMediaConfig;
    imageColumn?: string;
    getIcon?: FileTreeHooks["getIcon"];
  }
): FileTreeIcon {
  const custom = options.getIcon?.(row);
  if (custom && typeof custom === "object") {
    return { kind: options.folder ? "folder" : "file", ...custom };
  }
  if (custom) {
    return { kind: custom };
  }
  if (options.folder) {
    return { kind: options.expanded ? "folder-open" : "folder" };
  }
  const source = resolveGalleryMedia(
    row,
    options.media ? { ...options.media, enabled: true } : undefined,
    options.imageColumn
  );
  const byMime = kindFromMime(source?.mimeType ?? "");
  if (byMime) {
    return { kind: byMime };
  }
  if (source?.type && source.type !== "file") {
    return { kind: source.type };
  }
  const extension = EXTENSION_PATTERN.exec(
    nameOf(row, options.nameColumn)
  )?.[1]?.toLowerCase();
  return { kind: (extension && EXTENSION_KINDS[extension]) || "file" };
}

// ---------------------------------------------------------------- sorting

const collators = new Map<string, Intl.Collator>();
function collator(locale: string): Intl.Collator {
  const existing = collators.get(locale);
  if (existing) {
    return existing;
  }
  const created = new Intl.Collator(locale || undefined, {
    numeric: true,
    sensitivity: "base",
  });
  collators.set(locale, created);
  return created;
}

function sortableValue(value: unknown): number | string | undefined {
  if (value === null || value === undefined || value === "") {
    return;
  }
  if (typeof value === "number") {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  const text = String(value);
  const numeric = Number(text);
  if (text.trim() && Number.isFinite(numeric)) {
    return numeric;
  }
  const time = Date.parse(text);
  return DATE_PREFIX.test(text) && Number.isFinite(time) ? time : text;
}

function compareValues(left: unknown, right: unknown, locale: string): number {
  const a = sortableValue(left);
  const b = sortableValue(right);
  if (a === undefined || b === undefined) {
    if (a === b) {
      return 0;
    }
    return a === undefined ? 1 : -1;
  }
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return collator(locale).compare(String(a), String(b));
}

export interface FileTreeCompareOptions {
  nameColumn: string;
  foldersFirst: boolean;
  sort?: FileTreeSort;
  locale: string;
  isFolder: (row: Row) => boolean;
}

/** Folders first, then the sort column (natural, locale-aware), then the name. */
export function compareFileTreeRows(
  left: Row,
  right: Row,
  options: FileTreeCompareOptions
): number {
  if (options.foldersFirst) {
    const folderOrder =
      Number(options.isFolder(right)) - Number(options.isFolder(left));
    if (folderOrder) {
      return folderOrder;
    }
  }
  const sort = options.sort ?? { id: options.nameColumn };
  const direction = sort.desc ? -1 : 1;
  const primary = compareValues(left[sort.id], right[sort.id], options.locale);
  if (primary) {
    return primary * direction;
  }
  return (
    collator(options.locale).compare(
      nameOf(left, options.nameColumn),
      nameOf(right, options.nameColumn)
    ) || rowIdOf(left).localeCompare(rowIdOf(right))
  );
}

// ---------------------------------------------------------------- tree index

export interface FileTreeIndex {
  rows: Map<string, Row>;
  /** Effective parent after orphan and cycle handling (`FILETREE_UNFILED` for those). */
  parentOf: Map<string, string | null>;
  /** Sorted children per parent key (`FILETREE_ROOT`, a folder id or `FILETREE_UNFILED`). */
  children: Map<string, string[]>;
  folders: Set<string>;
  unfiled: string[];
}

export interface FileTreeBuildOptions {
  getRowId?: (row: Row) => string;
  settings: Pick<
    ResolvedFileTreeSettings,
    "parentColumn" | "kindColumn" | "nameColumn" | "foldersFirst" | "sort"
  >;
  hooks?: Pick<FileTreeHooks, "isFolder">;
  locale?: string;
}

const VISITING = 1;
const PLACED = 2;

/** Parents whose chain never reaches the root; the entry node of each cycle goes to Unfiled. */
function breakCycles(declared: Map<string, string | null>): Set<string> {
  const state = new Map<string, number>();
  const cyclic = new Set<string>();
  for (const start of declared.keys()) {
    const path: string[] = [];
    let current: string | null | undefined = start;
    while (current && declared.has(current) && !state.has(current)) {
      state.set(current, VISITING);
      path.push(current);
      current = declared.get(current);
    }
    if (current && state.get(current) === VISITING) {
      cyclic.add(current);
    }
    for (const id of path) {
      state.set(id, PLACED);
    }
  }
  return cyclic;
}

/**
 * Build the tree from loaded rows. Unknown parents and cycles are tolerated:
 * such nodes go to the virtual Unfiled folder, never lost.
 */
export function buildFileTreeIndex(
  rows: readonly Row[],
  options: FileTreeBuildOptions
): FileTreeIndex {
  const getId = options.getRowId ?? rowIdOf;
  const { settings } = options;
  const byId = new Map<string, Row>();
  for (const row of rows) {
    const id = getId(row);
    if (id && !byId.has(id)) {
      byId.set(id, row);
    }
  }
  const { parentOf, unfiled } = placeNodes(byId, settings.parentColumn);
  const children = new Map<string, string[]>([[FILETREE_ROOT, []]]);
  for (const [id, parent] of parentOf) {
    const key = parent ?? FILETREE_ROOT;
    const list = children.get(key) ?? [];
    list.push(id);
    children.set(key, list);
  }
  const folders = new Set<string>();
  for (const [id, row] of byId) {
    if (isFolderRow(row, settings, options.hooks, children.has(id))) {
      folders.add(id);
    }
  }
  const compare: FileTreeCompareOptions = {
    nameColumn: settings.nameColumn,
    foldersFirst: settings.foldersFirst,
    sort: settings.sort,
    locale: options.locale ?? "en",
    isFolder: (row) => folders.has(getId(row)),
  };
  for (const [key, ids] of children) {
    children.set(key, sortFileTreeIds(ids, byId, compare));
  }
  // Empty folders are known to be empty, not waiting for their content.
  for (const id of folders) {
    if (!children.has(id)) {
      children.set(id, []);
    }
  }
  if (unfiled.length) {
    folders.add(FILETREE_UNFILED);
    children.get(FILETREE_ROOT)?.push(FILETREE_UNFILED);
  }
  return { rows: byId, parentOf, children, folders, unfiled };
}

/** Effective parents: unknown parents and cycle entries go to Unfiled. */
function placeNodes(
  byId: ReadonlyMap<string, Row>,
  parentColumn: string
): { parentOf: Map<string, string | null>; unfiled: string[] } {
  const declared = new Map<string, string | null>();
  for (const [id, row] of byId) {
    declared.set(id, parentIdOf(row, parentColumn));
  }
  const cyclic = breakCycles(declared);
  const parentOf = new Map<string, string | null>();
  const unfiled: string[] = [];
  for (const [id, parent] of declared) {
    const orphan = parent !== null && !byId.has(parent);
    if (orphan || cyclic.has(id)) {
      parentOf.set(id, FILETREE_UNFILED);
      unfiled.push(id);
    } else {
      parentOf.set(id, parent);
    }
  }
  return { parentOf, unfiled };
}

export function sortFileTreeIds(
  ids: readonly string[],
  rows: ReadonlyMap<string, Row>,
  options: FileTreeCompareOptions
): string[] {
  return [...ids].sort((left, right) => {
    const a = rows.get(left);
    const b = rows.get(right);
    if (!(a && b)) {
      return Number(Boolean(b)) - Number(Boolean(a));
    }
    return compareFileTreeRows(a, b, options);
  });
}

/** Ancestors of a node, nearest last (root first), within the known parents. */
export function fileTreeAncestors(
  id: string,
  parentOf: (id: string) => string | null | undefined
): string[] {
  const path: string[] = [];
  const seen = new Set([id]);
  let current = parentOf(id);
  while (current && !seen.has(current)) {
    path.unshift(current);
    seen.add(current);
    current = parentOf(current);
  }
  return path;
}

// ---------------------------------------------------------------- flattening

export interface FileTreeChildren {
  ids: string[];
  /** Children on the server; more than `ids.length` shows a "Show more" row. */
  total?: number;
  /** More pages exist although the server gave no total. */
  hasMore?: boolean;
  loaded: boolean;
  loading?: boolean;
  error?: string;
}

export type FileTreeVisibleRow =
  | {
      type: "node";
      id: string;
      parentId: string | null;
      name: string;
      level: number;
      posinset: number;
      setsize: number;
      folder: boolean;
      expanded: boolean;
      /** False when the folder is known to be empty. */
      hasChildren: boolean;
      childCount?: number;
    }
  | {
      type: "more";
      id: string;
      parentId: string | null;
      level: number;
      remaining: number;
    }
  | { type: "loading"; id: string; parentId: string | null; level: number }
  | { type: "empty"; id: string; parentId: string | null; level: number }
  | {
      type: "error";
      id: string;
      parentId: string | null;
      level: number;
      message: string;
    }
  | { type: "draft"; id: string; parentId: string | null; level: number };

export interface FileTreeFlattenInput {
  children: (key: string) => FileTreeChildren | undefined;
  isFolder: (id: string) => boolean;
  name: (id: string) => string;
  expanded: ReadonlySet<string>;
  childCount?: (id: string) => number | undefined;
  /** Hide nodes outside this set (search results with their ancestors). */
  visible?: ReadonlySet<string>;
  /** Show an inline "new folder" row in this folder. */
  draftParent?: string | null;
  /** Start below this folder instead of the root (phone drill-down). */
  rootKey?: string;
}

const keyOf = (parent: string | null) => parent ?? FILETREE_ROOT;
const parentOfKey = (key: string) => (key === FILETREE_ROOT ? null : key);

function knownChildren(
  input: FileTreeFlattenInput,
  id: string
): number | undefined {
  const count = input.childCount?.(id);
  if (count !== undefined) {
    return count;
  }
  const entry = input.children(id);
  if (!entry?.loaded) {
    return;
  }
  return entry.total ?? entry.ids.length;
}

function statusRows(
  key: string,
  entry: FileTreeChildren | undefined,
  level: number,
  shown: number
): FileTreeVisibleRow[] {
  const parentId = parentOfKey(key);
  if (!entry || entry.loading) {
    return entry?.loaded && shown
      ? []
      : [{ type: "loading", id: `${key}:loading`, parentId, level }];
  }
  if (entry.error) {
    return [
      {
        type: "error",
        id: `${key}:error`,
        parentId,
        level,
        message: entry.error,
      },
    ];
  }
  if (!shown && key !== FILETREE_ROOT) {
    return [{ type: "empty", id: `${key}:empty`, parentId, level }];
  }
  const remaining = (entry.total ?? entry.ids.length) - entry.ids.length;
  if (remaining > 0 || entry.hasMore) {
    // An unknown remainder (no total from the server) is shown as 0.
    return [
      {
        type: "more",
        id: `${key}:more`,
        parentId,
        level,
        remaining: Math.max(0, remaining),
      },
    ];
  }
  return [];
}

/** The rows on screen: expanded folders' children in order, with their ARIA position. */
export function flattenFileTree(
  input: FileTreeFlattenInput
): FileTreeVisibleRow[] {
  const output: FileTreeVisibleRow[] = [];
  const visit = (key: string, level: number, trail: Set<string>): void => {
    const entry = input.children(key);
    const ids = (entry?.ids ?? []).filter(
      (id) => !(input.visible && !input.visible.has(id))
    );
    const draft =
      input.draftParent !== undefined && keyOf(input.draftParent) === key;
    if (draft) {
      output.push({
        type: "draft",
        id: `${key}:draft`,
        parentId: parentOfKey(key),
        level,
      });
    }
    const setsize = input.visible
      ? ids.length
      : Math.max(entry?.total ?? 0, ids.length);
    for (const [index, id] of ids.entries()) {
      const folder = input.isFolder(id);
      const count = folder ? knownChildren(input, id) : 0;
      const expanded = folder && input.expanded.has(id) && !trail.has(id);
      output.push({
        type: "node",
        id,
        parentId: parentOfKey(key),
        name: input.name(id),
        level,
        posinset: index + 1,
        setsize,
        folder,
        expanded,
        hasChildren: folder && count !== 0,
        childCount: count,
      });
      if (expanded) {
        visit(id, level + 1, new Set([...trail, id]));
      }
    }
    if (!input.visible) {
      output.push(...statusRows(key, entry, level, ids.length + Number(draft)));
    }
  };
  visit(input.rootKey ?? FILETREE_ROOT, 1, new Set());
  return output;
}

export type FileTreeNodeRow = Extract<FileTreeVisibleRow, { type: "node" }>;

export const isNodeRow = (row: FileTreeVisibleRow): row is FileTreeNodeRow =>
  row.type === "node";

/** Indentation level, capped so deep trees stay readable on phones. */
export const indentLevel = (level: number): number =>
  Math.min(level, FILETREE_MAX_INDENT) - 1;

// ---------------------------------------------------------------- expand all

export interface FileTreeSubtree {
  /** Folders in breadth-first order. */
  folders: string[];
  /** Nodes reached, folders and files. */
  count: number;
  truncated: boolean;
}

/** Breadth-first walk of the known subtree, stopping at `cap` nodes. */
export function collectFileTreeSubtree(
  rootKey: string,
  children: (key: string) => readonly string[] | undefined,
  isFolder: (id: string) => boolean,
  cap = FILETREE_MAX_NODES
): FileTreeSubtree {
  const folders: string[] = [];
  const seen = new Set<string>();
  let queue = [...(children(rootKey) ?? [])];
  let count = 0;
  while (queue.length) {
    const next: string[] = [];
    for (const id of queue) {
      if (seen.has(id)) {
        continue;
      }
      if (count >= cap) {
        return { folders, count, truncated: true };
      }
      seen.add(id);
      count += 1;
      if (isFolder(id)) {
        folders.push(id);
        next.push(...(children(id) ?? []));
      }
    }
    queue = next;
  }
  return { folders, count, truncated: false };
}

/** Expanded folders as saved in a view: order kept, duplicates and virtual folders removed, capped. */
export function serializeFileTreeExpanded(
  expanded: Iterable<string>,
  max = FILETREE_MAX_SAVED_EXPANDED
): string[] {
  return [...new Set(expanded)]
    .filter((id) => id && id !== FILETREE_UNFILED)
    .slice(0, max);
}

export function parseFileTreeExpanded(value: unknown): Set<string> {
  return new Set(cleanIds(value, FILETREE_MAX_SAVED_EXPANDED) ?? []);
}

/** Folders opened on first load, `depth` levels below the root. */
export function defaultExpandedIds(
  children: (key: string) => readonly string[] | undefined,
  isFolder: (id: string) => boolean,
  depth: number
): string[] {
  const opened: string[] = [];
  let level = (children(FILETREE_ROOT) ?? []).filter(isFolder);
  for (let current = 0; current < depth; current += 1) {
    opened.push(...level.filter((id) => id !== FILETREE_UNFILED));
    level = level.flatMap((id) => [...(children(id) ?? [])]).filter(isFolder);
  }
  return opened;
}

// ---------------------------------------------------------------- moves

export type FileTreeMoveReason =
  | "self"
  | "descendant"
  | "permission"
  | "not-folder"
  | "virtual"
  | "unchanged";

export type FileTreeMoveCheck =
  | { ok: true; parentId: string | null; ids: string[] }
  | { ok: false; reason: FileTreeMoveReason };

export interface FileTreeMoveContext {
  parentOf: (id: string) => string | null | undefined;
  isFolder: (id: string) => boolean;
  row: (id: string) => Row | undefined;
  canMove?: FileTreeHooks["canMove"];
}

/** Where a drop lands: a folder itself, or the parent of a file. */
export function fileTreeDropParent(
  targetId: string | null,
  context: Pick<FileTreeMoveContext, "isFolder" | "parentOf">
): string | null {
  if (targetId === null || context.isFolder(targetId)) {
    return targetId;
  }
  return context.parentOf(targetId) ?? null;
}

const MOVE_REASON_LABELS: Record<FileTreeMoveReason, FileTreeLabelKey> = {
  self: "intoSelf",
  descendant: "intoDescendant",
  permission: "noPermission",
  "not-folder": "notAFolder",
  virtual: "virtualFolder",
  unchanged: "alreadyThere",
};

export const moveReasonLabel = (reason: FileTreeMoveReason): FileTreeLabelKey =>
  MOVE_REASON_LABELS[reason];

/**
 * Whether these nodes may go into `parentId` (null is the root): not into
 * themselves or their descendants, only into folders, and with the host's
 * permission. Nodes already there are left out; nothing left is "unchanged".
 */
export function validateFileTreeMove(
  ids: readonly string[],
  parentId: string | null,
  context: FileTreeMoveContext
): FileTreeMoveCheck {
  const moving = [...new Set(ids)].filter((id) => id !== FILETREE_UNFILED);
  if (parentId === FILETREE_UNFILED) {
    return { ok: false, reason: "virtual" };
  }
  if (parentId !== null && moving.includes(parentId)) {
    return { ok: false, reason: "self" };
  }
  if (parentId !== null && !context.isFolder(parentId)) {
    return { ok: false, reason: "not-folder" };
  }
  if (parentId !== null) {
    const ancestors = new Set(fileTreeAncestors(parentId, context.parentOf));
    if (moving.some((id) => ancestors.has(id))) {
      return { ok: false, reason: "descendant" };
    }
  }
  const target = parentId === null ? null : (context.row(parentId) ?? null);
  const denied = moving.some((id) => {
    const row = context.row(id);
    return !row || context.canMove?.(row, target) === false;
  });
  if (denied) {
    return { ok: false, reason: "permission" };
  }
  const changed = moving.filter(
    (id) => (context.parentOf(id) ?? null) !== parentId
  );
  return changed.length
    ? { ok: true, parentId, ids: changed }
    : { ok: false, reason: "unchanged" };
}

/** Moves grouped by their original parent, to undo a batch. */
export function fileTreeUndoGroups(
  ids: readonly string[],
  parentOf: (id: string) => string | null | undefined
): { parentId: string | null; ids: string[] }[] {
  const groups = new Map<string | null, string[]>();
  for (const id of ids) {
    const parent = parentOf(id) ?? null;
    groups.set(parent, [...(groups.get(parent) ?? []), id]);
  }
  return [...groups].map(([parentId, grouped]) => ({ parentId, ids: grouped }));
}

// ---------------------------------------------------------------- keyboard

export interface FileTreeKey {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

export type FileTreeCommand =
  | { type: "none" }
  | { type: "focus"; id: string; extend?: boolean }
  | { type: "expand"; id: string }
  | { type: "collapse"; id: string }
  | { type: "toggle"; id: string }
  | { type: "open"; id: string }
  | { type: "select"; id: string }
  | { type: "select-all" }
  | { type: "clear" }
  | { type: "rename"; id: string }
  | { type: "cut" }
  | { type: "paste"; id: string }
  | { type: "delete" }
  | { type: "undo" }
  | { type: "menu"; id: string }
  | { type: "expand-siblings"; id: string }
  | { type: "expand-all" }
  | { type: "collapse-all" }
  | { type: "more"; parentId: string | null }
  | { type: "typeahead"; id?: string; buffer: string };

export interface FileTreeKeyState {
  rows: readonly FileTreeVisibleRow[];
  focusedId?: string;
  typeahead?: { buffer: string; at: number };
  now?: number;
}

const focusable = (row: FileTreeVisibleRow) =>
  row.type === "node" || row.type === "more";

function moveFocus(
  rows: readonly FileTreeVisibleRow[],
  index: number,
  step: number
): FileTreeVisibleRow | undefined {
  for (let next = index + step; next >= 0 && next < rows.length; next += step) {
    const row = rows[next];
    if (row && focusable(row)) {
      return row;
    }
  }
}

function typeaheadCommand(
  key: string,
  state: FileTreeKeyState,
  index: number
): FileTreeCommand {
  const now = state.now ?? Date.now();
  const previous =
    state.typeahead && now - state.typeahead.at < FILETREE_TYPEAHEAD_MS
      ? state.typeahead.buffer
      : "";
  const buffer = `${previous}${key}`.toLocaleLowerCase();
  const nodes = state.rows.filter(isNodeRow);
  const start = Math.max(
    0,
    nodes.findIndex((row) => row.id === state.rows[index]?.id)
  );
  // A new letter searches after the focused row; a longer prefix may stay on it.
  const offset = previous ? 0 : 1;
  const ordered = [
    ...nodes.slice(start + offset),
    ...nodes.slice(0, start + offset),
  ];
  const match = ordered.find((row) =>
    row.name.toLocaleLowerCase().startsWith(buffer)
  );
  return { type: "typeahead", id: match?.id, buffer };
}

function horizontalCommand(
  key: string,
  row: FileTreeNodeRow,
  state: FileTreeKeyState,
  index: number
): FileTreeCommand {
  if (key === "ArrowRight") {
    if (!(row.folder && row.hasChildren)) {
      return { type: "none" };
    }
    if (!row.expanded) {
      return { type: "expand", id: row.id };
    }
    const child = state.rows[index + 1];
    return child && focusable(child) && child.parentId === row.id
      ? { type: "focus", id: child.id }
      : { type: "none" };
  }
  if (row.folder && row.expanded) {
    return { type: "collapse", id: row.id };
  }
  return row.parentId === null
    ? { type: "none" }
    : { type: "focus", id: row.parentId };
}

function arrowCommand(
  event: FileTreeKey,
  row: FileTreeVisibleRow,
  state: FileTreeKeyState,
  index: number
): FileTreeCommand {
  if (event.altKey && event.shiftKey) {
    return {
      type: event.key === "ArrowDown" ? "expand-all" : "collapse-all",
    };
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    const target = moveFocus(
      state.rows,
      index,
      event.key === "ArrowDown" ? 1 : -1
    );
    return target
      ? { type: "focus", id: target.id, extend: Boolean(event.shiftKey) }
      : { type: "none" };
  }
  return row.type === "node"
    ? horizontalCommand(event.key, row, state, index)
    : { type: "none" };
}

const ARROWS = new Set(["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"]);

function modifiedCommand(
  event: FileTreeKey,
  row: FileTreeVisibleRow
): FileTreeCommand | undefined {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) {
    return;
  }
  const key = event.key.toLowerCase();
  if (key === "a") {
    return { type: "select-all" };
  }
  if (key === "x") {
    return { type: "cut" };
  }
  if (key === "v" && row.type === "node") {
    return { type: "paste", id: row.id };
  }
  if (key === "z" && !event.shiftKey) {
    return { type: "undo" };
  }
  return { type: "none" };
}

function edgeCommand(
  event: FileTreeKey,
  rows: readonly FileTreeVisibleRow[]
): FileTreeCommand | undefined {
  if (event.key !== "Home" && event.key !== "End") {
    return;
  }
  const candidates = rows.filter(focusable);
  const target = event.key === "Home" ? candidates[0] : candidates.at(-1);
  return target ? { type: "focus", id: target.id } : { type: "none" };
}

function nodeCommand(
  event: FileTreeKey,
  row: FileTreeVisibleRow
): FileTreeCommand | undefined {
  if (row.type === "more") {
    return event.key === "Enter" || event.key === " "
      ? { type: "more", parentId: row.parentId }
      : undefined;
  }
  if (row.type !== "node") {
    return;
  }
  const commands: Record<string, FileTreeCommand> = {
    Enter: row.folder
      ? { type: "toggle", id: row.id }
      : { type: "open", id: row.id },
    " ": { type: "select", id: row.id },
    F2: { type: "rename", id: row.id },
    Delete: { type: "delete" },
    Backspace: { type: "delete" },
    "*": { type: "expand-siblings", id: row.id },
    Escape: { type: "clear" },
    ContextMenu: { type: "menu", id: row.id },
  };
  if (event.key === "F10" && event.shiftKey) {
    return { type: "menu", id: row.id };
  }
  return commands[event.key];
}

/**
 * The WAI-ARIA tree keyboard model: arrows, Home/End, Enter, Space, `*`,
 * type-ahead, F2, Ctrl/Cmd+X/V/A/Z, Delete, Alt+Shift+↓/↑ for expand/collapse all.
 */
export function fileTreeKeyCommand(
  event: FileTreeKey,
  state: FileTreeKeyState
): FileTreeCommand {
  const index = Math.max(
    0,
    state.rows.findIndex((row) => row.id === state.focusedId)
  );
  const row = state.rows[index];
  if (!row) {
    return { type: "none" };
  }
  const modified = modifiedCommand(event, row);
  if (modified) {
    return modified;
  }
  if (ARROWS.has(event.key)) {
    return arrowCommand(event, row, state, index);
  }
  const edge = edgeCommand(event, state.rows);
  if (edge) {
    return edge;
  }
  const command = nodeCommand(event, row);
  if (command) {
    return command;
  }
  const printable =
    event.key.length === 1 && event.key !== " " && !event.altKey;
  return printable
    ? typeaheadCommand(event.key, state, index)
    : { type: "none" };
}

// ---------------------------------------------------------------- selection

/** Ids between the anchor and the target in visible order, both included. */
export function fileTreeRange(
  rows: readonly FileTreeVisibleRow[],
  anchorId: string | undefined,
  targetId: string
): string[] {
  const nodes = rows.filter(isNodeRow).map((row) => row.id);
  const to = nodes.indexOf(targetId);
  const from = anchorId ? nodes.indexOf(anchorId) : -1;
  if (to < 0) {
    return [];
  }
  if (from < 0) {
    return [targetId];
  }
  return nodes.slice(Math.min(from, to), Math.max(from, to) + 1);
}

export interface FileTreeClick {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

/** Plain click selects one row; Cmd/Ctrl toggles; Shift selects the range from the anchor. */
export function fileTreeSelectionAfterClick(
  rows: readonly FileTreeVisibleRow[],
  selection: ReadonlySet<string>,
  anchorId: string | undefined,
  id: string,
  click: FileTreeClick,
  multiple = true
): { selection: Set<string>; anchorId: string } {
  if (id === FILETREE_UNFILED) {
    return { selection: new Set(selection), anchorId: anchorId ?? id };
  }
  if (!multiple) {
    return { selection: new Set([id]), anchorId: id };
  }
  if (click.shiftKey) {
    const range = fileTreeRange(rows, anchorId, id).filter(
      (item) => item !== FILETREE_UNFILED
    );
    const base = click.metaKey || click.ctrlKey ? [...selection] : [];
    return {
      selection: new Set([...base, ...range]),
      anchorId: anchorId ?? id,
    };
  }
  if (click.metaKey || click.ctrlKey) {
    const next = new Set(selection);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return { selection: next, anchorId: id };
  }
  return { selection: new Set([id]), anchorId: id };
}

// ---------------------------------------------------------------- search

/** Whether the query narrows the records (search, filters or advanced filters). */
export function hasFileTreeQuery(params: Row): boolean {
  const query = compatibleListParams(params);
  const filters = Object.values(query.filters as Row).filter(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0)
  );
  return (
    String(query.search ?? "").trim() !== "" ||
    filters.length > 0 ||
    (query.advancedFilters as unknown[]).length > 0
  );
}

/** Ancestors of the matches found in the loaded rows (client fallback of `tree-matches`). */
export function fileTreeAncestorRows(
  matches: readonly Row[],
  allRows: readonly Row[],
  parentColumn: string,
  getRowId: (row: Row) => string = rowIdOf
): Row[] {
  const byId = new Map(allRows.map((row) => [getRowId(row), row]));
  const matchIds = new Set(matches.map(getRowId));
  const found = new Map<string, Row>();
  for (const match of matches) {
    const chain = fileTreeAncestors(getRowId(match), (id) => {
      const row =
        byId.get(id) ??
        (matchIds.has(id)
          ? matches.find((item) => getRowId(item) === id)
          : undefined);
      return row ? parentIdOf(row, parentColumn) : undefined;
    });
    for (const id of chain) {
      const row = byId.get(id);
      if (row && !matchIds.has(id)) {
        found.set(id, row);
      }
    }
  }
  return [...found.values()];
}

export interface FileTreeTextPart {
  text: string;
  match: boolean;
}

/** The name split around the search, for highlighting matches. */
export function highlightFileTreeName(
  name: string,
  query: string
): FileTreeTextPart[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) {
    return [{ text: name, match: false }];
  }
  const parts: FileTreeTextPart[] = [];
  const haystack = name.toLocaleLowerCase();
  let from = 0;
  let at = haystack.indexOf(needle, from);
  while (at >= 0) {
    if (at > from) {
      parts.push({ text: name.slice(from, at), match: false });
    }
    parts.push({ text: name.slice(at, at + needle.length), match: true });
    from = at + needle.length;
    at = haystack.indexOf(needle, from);
  }
  if (from < name.length) {
    parts.push({ text: name.slice(from), match: false });
  }
  return parts;
}

// ---------------------------------------------------------------- formats

const SIZE_UNITS = ["B", "kB", "MB", "GB", "TB"];
const BYTES_STEP = 1000;

/** Bytes in decimal units, as Finder and Drive show them (`1.2 MB`). */
export function formatFileSize(value: unknown, locale = "en"): string {
  const bytes = Number(value);
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(bytes)
  ) {
    return "--";
  }
  let size = Math.max(0, bytes);
  let unit = 0;
  while (size >= BYTES_STEP && unit < SIZE_UNITS.length - 1) {
    size /= BYTES_STEP;
    unit += 1;
  }
  const digits = unit === 0 || size >= 100 ? 0 : 1;
  const text = new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(size);
  return `${text} ${SIZE_UNITS[unit]}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK_DAYS = 7;

const capitalize = (text: string, locale: string) =>
  text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);

function toDate(value: unknown): Date | undefined {
  if (value === null || value === undefined || value === "") {
    return;
  }
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "Just now", "5 minutes ago", "2 hours ago", "Yesterday", "3 days ago", then the date. */
export function formatRelativeDate(
  value: unknown,
  locale = "en",
  now: Date = new Date()
): string {
  const date = toDate(value);
  if (!date) {
    return "--";
  }
  const elapsed = now.getTime() - date.getTime();
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (elapsed >= 0 && elapsed < MINUTE) {
    return fileTreeLabel("justNow", locale);
  }
  if (elapsed >= 0 && elapsed < HOUR) {
    return capitalize(
      format.format(-Math.floor(elapsed / MINUTE), "minute"),
      locale
    );
  }
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  if (elapsed >= 0 && days === 0) {
    return capitalize(
      format.format(-Math.floor(elapsed / HOUR), "hour"),
      locale
    );
  }
  if (days > 0 && days < WEEK_DAYS) {
    return capitalize(format.format(-days, "day"), locale);
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

/** A property's text in rows and in the details pane. */
export function formatFileTreeValue(
  value: unknown,
  column: FileTreeColumn | undefined,
  options: {
    locale: string;
    settings: Pick<ResolvedFileTreeSettings, "sizeColumn" | "updatedColumn">;
    folder?: boolean;
    folderSize?: number;
    now?: Date;
  }
): string {
  const id = column?.id;
  if (id && id === options.settings.sizeColumn) {
    return options.folder
      ? formatFileSize(options.folderSize, options.locale)
      : formatFileSize(value, options.locale);
  }
  if (id && id === options.settings.updatedColumn) {
    return formatRelativeDate(value, options.locale, options.now);
  }
  if (value === null || value === undefined || value === "") {
    return "--";
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => formatFileTreeValue(item, column, options))
      .join(", ");
  }
  if (column?.type === "number") {
    return formatNumberValue(
      value,
      column.numberFormat as NumberFormatConfig,
      options.locale
    );
  }
  if (column?.type === "date") {
    return formatRelativeDate(value, options.locale, options.now);
  }
  const option = column?.options?.find((item) => item.value === value);
  if (option) {
    return String(option.label ?? option.value);
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** "6 folders · 15 files" for the header. */
export function fileTreeSummary(
  counts: { folders: number; files: number },
  locale: string,
  translate?: FileTreeTranslate
): string {
  const part = (
    count: number,
    one: FileTreeLabelKey,
    many: FileTreeLabelKey
  ) =>
    count === 1
      ? fileTreeLabel(one, locale, translate)
      : fileTreeLabel(many, locale, translate, { count });
  return `${part(counts.folders, "oneFolder", "folders")} · ${part(counts.files, "oneFile", "files")}`;
}

/** Breadcrumb text: names joined with ›. */
export const fileTreePathText = (names: readonly string[]): string =>
  names.join(" › ");

// ---------------------------------------------------------------- windowing

export interface FileTreeWindow {
  start: number;
  end: number;
  before: number;
  after: number;
}

/** Visible slice of a fixed-height list; ARIA positions come from the rows, not the slice. */
export function fileTreeWindow(input: {
  count: number;
  rowHeight: number;
  scrollTop: number;
  viewport: number;
  overscan?: number;
}): FileTreeWindow {
  const overscan = input.overscan ?? 8;
  const height = Math.max(1, input.rowHeight);
  const start = Math.max(0, Math.floor(input.scrollTop / height) - overscan);
  const end = Math.min(
    input.count,
    Math.ceil((input.scrollTop + input.viewport) / height) + overscan
  );
  return {
    start,
    end: Math.max(start, end),
    before: start * height,
    after: Math.max(0, input.count - Math.max(start, end)) * height,
  };
}

/** Scroll offset keeping row `index` inside the viewport. */
export function fileTreeScrollTo(
  index: number,
  rowHeight: number,
  scrollTop: number,
  viewport: number
): number {
  const top = index * rowHeight;
  if (top < scrollTop) {
    return top;
  }
  if (top + rowHeight > scrollTop + viewport) {
    return top + rowHeight - viewport;
  }
  return scrollTop;
}

/** Scroll speed near the edges of a drag area: negative up, positive down. */
export function fileTreeAutoScroll(
  pointerY: number,
  top: number,
  bottom: number,
  edge = 48,
  maxStep = 18
): number {
  if (pointerY < top + edge) {
    return -Math.ceil(((top + edge - pointerY) / edge) * maxStep);
  }
  if (pointerY > bottom - edge) {
    return Math.ceil(((pointerY - (bottom - edge)) / edge) * maxStep);
  }
  return 0;
}

/** The tree row under the pointer during a drag. */
export function fileTreeRowAt(x: number, y: number): string | undefined {
  if (typeof document === "undefined") {
    return;
  }
  const element = document
    .elementFromPoint(x, y)
    ?.closest(`[${FILETREE_ROW_ATTRIBUTE}]`);
  return element?.getAttribute(FILETREE_ROW_ATTRIBUTE) ?? undefined;
}

// ---------------------------------------------------------------- URL

export const fileTreeFolderKey = (tableId: string): string =>
  `${tableId}-folder`;

/** The folder opened by a link (`?<tableId>-folder=<id>`). */
export function readFileTreeFolderParam(tableId: string): string | undefined {
  if (typeof window === "undefined") {
    return;
  }
  return (
    new URLSearchParams(window.location.search).get(
      fileTreeFolderKey(tableId)
    ) ?? undefined
  );
}

/** Keep the open folder in the URL without adding history entries. */
export function writeFileTreeFolderParam(
  tableId: string,
  id: string | null | undefined
): void {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  const key = fileTreeFolderKey(tableId);
  if ((url.searchParams.get(key) ?? undefined) === (id ?? undefined)) {
    return;
  }
  if (id) {
    url.searchParams.set(key, id);
  } else {
    url.searchParams.delete(key);
  }
  window.history.replaceState(window.history.state, "", url);
}

// ---------------------------------------------------------------- layout

/** Grid columns of the tree table: selection, Name, the other columns, actions. */
export function fileTreeGridColumns(
  columnCount: number,
  selectable: boolean
): { full: string; compact: string } {
  const select = selectable ? "2.5rem " : "";
  const others = " minmax(6rem, 9rem)".repeat(columnCount);
  return {
    full: `${select}minmax(12rem, 1fr)${others} 2.75rem`,
    compact: `${select}minmax(0, 1fr) 2.75rem`,
  };
}

/** How a row shows the current drag: the receiving folder, or an invalid target. */
export function fileTreeDropMark(
  rowId: string,
  drag:
    | { overId?: string; parentId?: string | null; valid: boolean }
    | undefined
): "valid" | "invalid" | undefined {
  if (!drag?.overId) {
    return;
  }
  if (drag.valid) {
    return rowId === (drag.parentId ?? FILETREE_ROOT_TARGET)
      ? "valid"
      : undefined;
  }
  return rowId === drag.overId ? "invalid" : undefined;
}

/** Rows kept in the DOM at once before the list is windowed. */
export const FILETREE_WINDOW_THRESHOLD = 150;
/** Row height in pixels, shared by both editions for windowing. */
export const FILETREE_ROW_HEIGHT = 40;

// ---------------------------------------------------------------- settings panel

export interface FileTreeSettingField {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

const NONE = "";
const COLUMN_PRESETS = ["both", "size", "updated", "none"] as const;
type ColumnPreset = (typeof COLUMN_PRESETS)[number];

function columnPreset(
  settings: ResolvedFileTreeSettings
): ColumnPreset | undefined {
  const { columns, sizeColumn, updatedColumn } = settings;
  const key = columns.join(",");
  const presets: Record<ColumnPreset, string> = {
    both: [sizeColumn, updatedColumn].filter(Boolean).join(","),
    size: sizeColumn ?? "-",
    updated: updatedColumn ?? "-",
    none: "",
  };
  return COLUMN_PRESETS.find((preset) => presets[preset] === key);
}

function presetColumns(
  preset: string,
  settings: ResolvedFileTreeSettings
): string[] {
  const { sizeColumn, updatedColumn } = settings;
  const byPreset: Record<string, (string | undefined)[]> = {
    both: [sizeColumn, updatedColumn],
    size: [sizeColumn],
    updated: [updatedColumn],
    none: [],
  };
  return (byPreset[preset] ?? []).filter((id): id is string => Boolean(id));
}

/** Fields of View → Card settings, identical in both editions. */
export function fileTreeSettingFields(input: {
  columns: readonly FileTreeColumn[];
  defaults?: FileTreeViewSettings;
  view: FileTreeViewSettings;
  locale: string;
  translate?: FileTreeTranslate;
  update: (next: FileTreeViewSettings | undefined) => void;
}): FileTreeSettingField[] {
  const { columns, locale, translate, view } = input;
  const label = (key: FileTreeLabelKey) =>
    fileTreeLabel(key, locale, translate);
  const active = resolveFileTreeSettings(columns, input.defaults, view);
  const usable = usableColumns(columns);
  const option = (column: FileTreeColumn) => ({
    value: column.id,
    label: column.header ?? column.id,
  });
  const none = { value: NONE, label: label("none") };
  const set = (patch: FileTreeViewSettings) => {
    const next: Record<string, unknown> = { ...view, ...patch };
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === NONE) {
        Reflect.deleteProperty(next, key);
      }
    }
    input.update(next as FileTreeViewSettings);
  };
  const onOff = (value: boolean) => (value ? "on" : "off");
  const onOffOptions = [
    { value: "on", label: label("on") },
    { value: "off", label: label("off") },
  ];
  const column = (
    id: keyof FileTreeViewSettings,
    title: FileTreeLabelKey,
    value: string | undefined,
    choices: FileTreeColumn[],
    optional: boolean
  ): FileTreeSettingField => ({
    id,
    label: label(title),
    value: value ?? NONE,
    options: [...(optional ? [none] : []), ...choices.map(option)],
    onChange: (next) => set({ [id]: next || undefined }),
  });
  const preset = columnPreset(active);
  return [
    column(
      "parentColumn",
      "settingsParent",
      active.parentColumn,
      usable,
      false
    ),
    column("nameColumn", "settingsName", active.nameColumn, usable, false),
    column("kindColumn", "settingsKind", active.kindColumn, usable, true),
    column(
      "sizeColumn",
      "settingsSize",
      active.sizeColumn,
      usable.filter((item) => item.type === "number"),
      true
    ),
    column(
      "updatedColumn",
      "settingsUpdated",
      active.updatedColumn,
      usable.filter((item) => item.type === "date"),
      true
    ),
    {
      id: "columns",
      label: label("settingsColumns"),
      value: preset ?? NONE,
      options: [
        ...(preset ? [] : [{ value: NONE, label: active.columns.join(", ") }]),
        { value: "both", label: label("columnsBoth") },
        { value: "size", label: label("columnsSize") },
        { value: "updated", label: label("columnsUpdated") },
        { value: "none", label: label("columnsNone") },
      ],
      onChange: (next) => {
        if (next) {
          set({ columns: presetColumns(next, active) });
        }
      },
    },
    {
      id: "showDetails",
      label: label("settingsDetails"),
      value: onOff(active.showDetails),
      options: onOffOptions,
      onChange: (next) => set({ showDetails: next === "on" }),
    },
    {
      id: "foldersFirst",
      label: label("settingsFoldersFirst"),
      value: onOff(active.foldersFirst),
      options: onOffOptions,
      onChange: (next) => set({ foldersFirst: next === "on" }),
    },
    {
      id: "defaultExpandedDepth",
      label: label("settingsDepth"),
      value: String(active.defaultExpandedDepth),
      options: [
        { value: "0", label: label("depth0") },
        { value: "1", label: label("depth1") },
        { value: "2", label: label("depth2") },
      ],
      onChange: (next) => set({ defaultExpandedDepth: Number(next) }),
    },
  ];
}
