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
    | "clearFilters"
    | "copyLink"
    | "ascending"
    | "descending"
    | "addSort"
    | "all"
    | "none"
    | "selectAll"
    | "selectRow"
    | "bulkEdit"
    | "copy"
    | "cancel"
    | "confirm"
  >
> &
  DataTableTranslations = {
  cardImage: "Image",
  cardTitle: "Title",
  cardRatio: "Ratio",
  cardFit: "Fit",
  cardSize: "Size",
  cardSquare: "Square",
  cardPortrait: "Portrait",
  cardVideo: "Video",
  cardWide: "Wide",
  cardCover: "Cover",
  cardContain: "Contain",
  cardSmall: "Small",
  cardMedium: "Medium",
  cardLarge: "Large",
  cardShowLabels: "Show labels",
  cardLane: "Lane",
  search: "Search…",
  columnOptions: "Column options",
  clearSort: "Clear sort",
  pinLeft: "Pin left",
  pinRight: "Pin right",
  unpin: "Unpin",
  hideColumn: "Hide column",
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
  clearFilters: "Clear filters",
  copyLink: "Copy link",
  ascending: "Ascending",
  descending: "Descending",
  addSort: "Add sort",
  all: "All",
  none: "None",
  selectAll: "Select all",
  selectRow: "Select",
  bulkEdit: "Bulk edit",
  bulkApplyField: "Apply",
  bulkChooseFields: "Choose at least one field to apply.",
  bulkEditDescription:
    "Only checked fields are applied to the selected rows. Unchecked fields stay unchanged.",
  bulkEditDenied: "These rows can no longer be edited.",
  bulkMixedForms: "Select rows with the same edit form.",
  bulkUpdated: "Selected rows updated",
  copy: "Copy",
  cancel: "Cancel",
  confirm: "Confirm",
};

export const frenchTranslations: DataTableTranslations = {
  cardImage: "Image",
  cardTitle: "Titre",
  cardRatio: "Proportions",
  cardFit: "Ajustement",
  cardSize: "Taille",
  cardSquare: "Carré",
  cardPortrait: "Portrait",
  cardVideo: "Vidéo",
  cardWide: "Large",
  cardCover: "Couvrir",
  cardContain: "Contenir",
  cardSmall: "Petit",
  cardMedium: "Moyen",
  cardLarge: "Grand",
  cardShowLabels: "Afficher les libellés",
  cardLane: "Colonne",
  search: "Rechercher…",
  columnOptions: "Options de colonne",
  clearSort: "Effacer le tri",
  pinLeft: "Épingler à gauche",
  pinRight: "Épingler à droite",
  unpin: "Désépingler",
  hideColumn: "Masquer la colonne",
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
  clearFilters: "Effacer les filtres",
  copyLink: "Copier le lien",
  ascending: "Croissant",
  descending: "Décroissant",
  addSort: "Ajouter un tri",
  all: "Tous",
  none: "Aucun",
  selectAll: "Tout sélectionner",
  selectRow: "Sélectionner",
  bulkEdit: "Modification groupée",
  bulkApplyField: "Appliquer",
  bulkChooseFields: "Choisissez au moins un champ à appliquer.",
  bulkEditDescription:
    "Seuls les champs cochés sont appliqués aux lignes sélectionnées. Les autres champs restent inchangés.",
  bulkEditDenied: "Ces lignes ne peuvent plus être modifiées.",
  bulkMixedForms:
    "Sélectionnez des lignes utilisant le même formulaire de modification.",
  bulkUpdated: "Lignes sélectionnées mises à jour",
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
