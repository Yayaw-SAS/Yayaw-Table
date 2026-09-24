import {
  type ConditionField,
  evaluateForm,
  type FormEvaluation,
  type FormRule,
  rulesReading,
} from "./form-conditions";

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
    case "location":
    case "select":
    case "radio":
    case "select-with-add-new":
      return { value: null };
    default:
      return;
  }
}

/** Words of the bulk editor's condition notes. */
export const bulkConditionMessages = (locale = "en") =>
  locale.startsWith("fr")
    ? {
        mixedBlocked:
          "Dépend de {fields}, dont les valeurs diffèrent entre les lignes. Modifiez d’abord {fields}.",
        mixedNote:
          "Les valeurs de {fields} diffèrent entre les lignes : la condition est considérée comme non remplie.",
      }
    : {
        mixedBlocked:
          "Depends on {fields}, whose values differ across the selection. Set {fields} first.",
        mixedNote:
          "Values of {fields} differ across the selection: the condition is treated as not met.",
      };

const sameValue = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

export interface BulkConditionInput {
  rules: readonly FormRule[];
  fields: readonly ConditionField[];
  /** The selected rows. */
  rows: readonly Record<string, unknown>[];
  /** Fields added to the bulk draft. */
  applied: readonly string[];
  /** The draft values. */
  values: Record<string, unknown>;
}

/**
 * Rules in a bulk editor: conditions read the edited values, or the value
 * shared by every selected row. A field whose value differs across the
 * selection (and is not set in the draft) is "mixed": conditions on it never
 * match.
 */
export function bulkConditionState(input: BulkConditionInput): {
  evaluation: FormEvaluation;
  mixed: string[];
} {
  const [first] = input.rows;
  const mixed = input.fields
    .map((field) => field.id)
    .filter(
      (id) =>
        !input.applied.includes(id) &&
        input.rows.some((row) => !sameValue(row[id], first?.[id]))
    );
  const values = Object.fromEntries(
    input.fields.map((field) => [
      field.id,
      input.applied.includes(field.id)
        ? input.values[field.id]
        : first?.[field.id],
    ])
  );
  return {
    evaluation: evaluateForm(input.rules, values, input.fields, { mixed }),
    mixed,
  };
}

/** Labels of the mixed fields the rules of `target` read. */
export function bulkMixedDependencies(
  input: Pick<BulkConditionInput, "fields" | "rules">,
  target: string,
  mixed: readonly string[]
): string[] {
  const labels = new Map(
    input.fields.map((field) => [field.id, field.label ?? field.id])
  );
  return rulesReading(input.rules, target, mixed).map(
    (id) => labels.get(id) ?? id
  );
}
