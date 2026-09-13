/** Shared copy and clear-value conventions for both independently installed registries. */
export const bulkEditorMessages = (locale = "en") =>
  locale.startsWith("fr")
    ? {
        titleOne: "Modifier 1 ligne",
        titleMany: "Modifier {count} lignes",
        applyOne: "Appliquer à 1 ligne",
        applyMany: "Appliquer à {count} lignes",
        description: "Les autres propriétés restent inchangées.",
        addField: "Ajouter un champ",
        searchFields: "Rechercher une propriété…",
        noFields: "Aucune propriété disponible",
        empty: "Ajoutez les propriétés à modifier.",
        removeField: "Retirer {field}",
        clearValue: "Effacer la valeur",
        cancel: "Annuler",
        close: "Fermer",
        saving: "Enregistrement…",
      }
    : {
        titleOne: "Edit 1 row",
        titleMany: "Edit {count} rows",
        applyOne: "Apply to 1 row",
        applyMany: "Apply to {count} rows",
        description: "Other properties stay unchanged.",
        addField: "Add a field",
        searchFields: "Search properties…",
        noFields: "No properties available",
        empty: "Add the properties you want to change.",
        removeField: "Remove {field}",
        clearValue: "Clear value",
        cancel: "Cancel",
        close: "Close",
        saving: "Saving…",
      };
export type BulkEditorMessages = ReturnType<typeof bulkEditorMessages>;

/** Required fields and boolean/custom editors never imply a clear operation. */
export function bulkClearCandidate(field: {
  type: string;
  required?: boolean;
}): { value: unknown } | undefined {
  if (field.required) {
    return;
  }
  switch (field.type) {
    case "text":
    case "string":
    case "textarea":
    case "url":
    case "image":
      return { value: "" };
    case "multiSelect":
    case "collection":
      return { value: [] };
    case "number":
    case "date":
    case "json":
    case "select":
    case "radio":
    case "select-with-add-new":
      return { value: null };
    default:
      return;
  }
}
