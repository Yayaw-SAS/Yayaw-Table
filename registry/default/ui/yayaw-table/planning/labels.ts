/**
 * Planning labels live outside the renderer so both framework editions share one
 * vocabulary and either can override it from the host's own translation system.
 */
const words = {
  en: {
    planning: "Planning",
    task: "Task",
    start: "Start",
    end: "End",
    parent: "Parent",
    root: "No parent",
    source: "Table",
    predecessor: "Predecessor",
    type: "Dependency type",
    lag: "Offset",
    unit: "Count offset in",
    working: "Working days",
    calendar: "Calendar days",
    dependencies: "Dependencies",
    add: "Add dependency",
    edit: "Edit",
    remove: "Remove",
    preview: "Review changes",
    apply: "Apply all changes",
    cancel: "Cancel",
    save: "Preview changes",
    close: "Close",
    loading: "Loading planning…",
    retry: "Reload planning",
    empty: "No tasks match this view",
    clear: "Clear filters",
    unscheduled: "Not scheduled",
    before: "Before",
    after: "After",
    reason: "Reason",
    day: "Day",
    week: "Week",
    month: "Month",
    today: "Today",
    previous: "Previous period",
    next: "Next period",
    weekStart: "First day of week",
    showLinks: "Show dependencies",
    move: "Move",
    resizeStart: "Resize start",
    resizeEnd: "Resize end",
    expand: "Expand",
    collapse: "Collapse",
    noAdapter:
      "Configure table.planning and actions.planning to load this planning.",
    record: "Open record",
    newLink: "New dependency",
    requested: "Requested change",
    summary: "Summary dates",
    group: "Group or calendar adjustment",
    dependency: "Dependency",
    noDates: "—",
    relationsChanged: "Dependency changes are included in this transaction.",
    settings: "Gantt settings",
    zoom: "Zoom",
  },
  fr: {
    planning: "Planification",
    task: "Élément",
    start: "Début",
    end: "Fin",
    parent: "Parent",
    root: "Sans parent",
    source: "Table",
    predecessor: "Prédécesseur",
    type: "Type de dépendance",
    lag: "Décalage",
    unit: "Compter le décalage en",
    working: "Jours ouvrés",
    calendar: "Jours calendaires",
    dependencies: "Dépendances",
    add: "Ajouter une dépendance",
    edit: "Modifier",
    remove: "Supprimer",
    preview: "Vérifier les modifications",
    apply: "Appliquer toutes les modifications",
    cancel: "Annuler",
    save: "Prévisualiser",
    close: "Fermer",
    loading: "Chargement du planning…",
    retry: "Recharger le planning",
    empty: "Aucun élément ne correspond à cette vue",
    clear: "Effacer les filtres",
    unscheduled: "Non planifié",
    before: "Avant",
    after: "Après",
    reason: "Raison",
    day: "Jour",
    week: "Semaine",
    month: "Mois",
    today: "Aujourd’hui",
    previous: "Période précédente",
    next: "Période suivante",
    weekStart: "Premier jour de la semaine",
    showLinks: "Afficher les dépendances",
    move: "Déplacer",
    resizeStart: "Modifier le début",
    resizeEnd: "Modifier la fin",
    expand: "Déplier",
    collapse: "Replier",
    noAdapter:
      "Configurer table.planning et actions.planning pour charger ce planning.",
    record: "Ouvrir la fiche",
    newLink: "Nouvelle dépendance",
    requested: "Modification demandée",
    summary: "Dates récapitulatives",
    group: "Ajustement du groupe ou calendrier",
    dependency: "Dépendance",
    noDates: "—",
    relationsChanged:
      "Les modifications des dépendances sont incluses dans cette transaction.",
    settings: "Réglages du Gantt",
    zoom: "Zoom",
  },
};

export type PlanningSurfaceLabels = typeof words.en;

/** The built-in vocabulary stays the fallback, so a host only translates what it wants to. */
export function planningLabels(
  locale?: string,
  overrides?: Partial<PlanningSurfaceLabels>
): PlanningSurfaceLabels {
  const base = (
    locale?.startsWith("fr") ? words.fr : words.en
  ) as PlanningSurfaceLabels;
  return overrides ? { ...base, ...overrides } : base;
}

export const PLANNING_LABEL_KEYS = Object.keys(
  words.en
) as (keyof PlanningSurfaceLabels)[];

/**
 * Reads `views.gantt.<key>` from the table's translations. A translate function that
 * echoes an unknown key leaves that label on its built-in value.
 */
export function planningLabelOverrides(
  translate: (key: string) => string
): Partial<PlanningSurfaceLabels> {
  const overrides: Partial<PlanningSurfaceLabels> = {};
  for (const key of PLANNING_LABEL_KEYS) {
    const path = `views.gantt.${key}`;
    const value = translate(path);
    if (value && value !== path) {
      overrides[key] = value;
    }
  }
  return overrides;
}
