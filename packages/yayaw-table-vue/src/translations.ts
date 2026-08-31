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
    | "actions"
    | "openActions"
    | "options"
    | "properties"
    | "sort"
    | "group"
    | "calculations"
    | "calculationsOn"
    | "calculationsOff"
    | "reset"
    | "copyLink"
    | "ascending"
    | "descending"
    | "addSort"
    | "all"
    | "none"
    | "selectAll"
    | "bulkEdit"
    | "copy"
    | "cancel"
    | "confirm"
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
  actions: "Actions",
  openActions: "Open actions menu",
  options: "Options",
  properties: "Properties",
  sort: "Sort",
  group: "Group",
  calculations: "Footer calculations",
  calculationsOn: "Shown",
  calculationsOff: "Hidden",
  reset: "Reset",
  copyLink: "Copy link",
  ascending: "Ascending",
  descending: "Descending",
  addSort: "Add sort",
  all: "All",
  none: "None",
  selectAll: "Select all",
  bulkEdit: "Bulk edit",
  copy: "Copy",
  cancel: "Cancel",
  confirm: "Confirm",
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
  actions: "Actions",
  openActions: "Ouvrir le menu des actions",
  options: "Options",
  properties: "Propriétés",
  sort: "Trier",
  group: "Grouper",
  calculations: "Calculs de pied de tableau",
  calculationsOn: "Affichés",
  calculationsOff: "Masqués",
  reset: "Réinitialiser",
  copyLink: "Copier le lien",
  ascending: "Croissant",
  descending: "Décroissant",
  addSort: "Ajouter un tri",
  all: "Tous",
  none: "Aucun",
  selectAll: "Tout sélectionner",
  bulkEdit: "Modification groupée",
  copy: "Copier",
  cancel: "Annuler",
  confirm: "Confirmer",
};

export const createTranslations = (
  locale: string,
  overrides?: DataTableTranslations
): DataTableTranslations => ({
  ...defaultTranslations,
  ...(locale.toLowerCase().startsWith("fr") ? frenchTranslations : {}),
  ...overrides,
});
