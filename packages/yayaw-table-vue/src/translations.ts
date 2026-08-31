import type { DataTableTranslations } from "./types";

export const defaultTranslations: Required<
  Pick<
    DataTableTranslations,
    | "search"
    | "create"
    | "edit"
    | "delete"
    | "duplicate"
    | "export"
    | "filters"
    | "columns"
    | "views"
    | "saveView"
    | "noResults"
    | "loading"
    | "previous"
    | "next"
    | "selected"
    | "rowsPerPage"
  >
> &
  DataTableTranslations = {
  search: "Search…",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  duplicate: "Duplicate",
  export: "Export",
  filters: "Filters",
  columns: "Columns",
  views: "Views",
  saveView: "Save view",
  noResults: "No results",
  loading: "Loading…",
  previous: "Previous",
  next: "Next",
  selected: "selected",
  rowsPerPage: "Rows per page",
};

export const frenchTranslations: DataTableTranslations = {
  search: "Rechercher…",
  create: "Créer",
  edit: "Modifier",
  delete: "Supprimer",
  duplicate: "Dupliquer",
  export: "Exporter",
  filters: "Filtres",
  columns: "Colonnes",
  views: "Vues",
  saveView: "Enregistrer la vue",
  noResults: "Aucun résultat",
  loading: "Chargement…",
  previous: "Précédent",
  next: "Suivant",
  selected: "sélectionné(s)",
  rowsPerPage: "Lignes par page",
};

export const createTranslations = (
  locale: string,
  overrides?: DataTableTranslations
): DataTableTranslations => ({
  ...defaultTranslations,
  ...(locale.toLowerCase().startsWith("fr") ? frenchTranslations : {}),
  ...overrides,
});
