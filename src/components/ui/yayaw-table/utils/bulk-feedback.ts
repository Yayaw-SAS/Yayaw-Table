/**
 * Feedback copy for bulk actions (delete, copy, edit, export), shared by both
 * independently installed registries. Hosts override any key through
 * `translations.bulk.feedback` (React) or `bulk.feedback.<key>` (Vue).
 */
export const bulkFeedbackMessages = (locale = "en") =>
  locale.startsWith("fr")
    ? {
        deletedOne: "1 ligne supprimée.",
        deletedMany: "{count} lignes supprimées.",
        deletedPartial:
          "Lignes supprimées : {count} sur {total}, {failed} en échec.",
        deleteFailedOne: "Impossible de supprimer 1 ligne.",
        deleteFailedMany: "Impossible de supprimer {count} lignes.",
        deleteError:
          "Impossible de supprimer les lignes sélectionnées. Réessayez.",
        deleteRowError: "Impossible de supprimer la ligne « {id} ».",
        notDeleted: "Lignes non supprimées : {failed} sur {total}.",
        deleteDisabled: "La suppression groupée est désactivée pour ce tableau.",
        deleteTitleOne: "Supprimer 1 ligne ?",
        deleteTitleMany: "Supprimer {count} lignes ?",
        deleteDescription: "Cette action est irréversible.",
        copiedOne: "1 ligne copiée.",
        copiedMany: "{count} lignes copiées.",
        copiedToClipboardOne: "1 ligne copiée dans le presse-papiers.",
        copiedToClipboardMany: "{count} lignes copiées dans le presse-papiers.",
        copyError: "Impossible de copier les lignes sélectionnées.",
        clipboardUnavailable: "Le presse-papiers n'est pas disponible ici.",
        editError: "La modification groupée a échoué.",
        editDisabled: "La modification groupée est désactivée pour ce tableau.",
        editJsonHint: "Champs JSON à modifier sur {count} lignes.",
        exportError: "Impossible d'exporter les lignes sélectionnées.",
        actionError: "{action} : l'action a échoué.",
        noValidIds: "Aucun identifiant valide parmi les lignes sélectionnées.",
        selectAllError:
          "Impossible de sélectionner toutes les lignes correspondantes.",
      }
    : {
        deletedOne: "Deleted 1 row successfully.",
        deletedMany: "Deleted {count} rows successfully.",
        deletedPartial: "Deleted {count} of {total} rows. {failed} failed.",
        deleteFailedOne: "Failed to delete 1 row.",
        deleteFailedMany: "Failed to delete {count} rows.",
        deleteError: "Failed to delete selected rows. Please try again.",
        deleteRowError: 'Could not delete row with id "{id}".',
        notDeleted: "{failed} of {total} rows could not be deleted",
        deleteDisabled: "Bulk delete is disabled by table configuration.",
        deleteTitleOne: "Delete 1 row?",
        deleteTitleMany: "Delete {count} rows?",
        deleteDescription: "This action cannot be undone.",
        copiedOne: "Copied 1 row.",
        copiedMany: "Copied {count} rows.",
        copiedToClipboardOne: "Copied 1 row to clipboard.",
        copiedToClipboardMany: "Copied {count} rows to clipboard.",
        copyError: "Failed to copy selected rows.",
        clipboardUnavailable:
          "Clipboard API is not available in this environment.",
        editError: "Bulk edit failed.",
        editDisabled: "Bulk edit is disabled by table configuration.",
        editJsonHint: "JSON fields to update on {count} rows.",
        exportError: "Failed to export selected rows.",
        actionError: "{action} failed",
        noValidIds: "No valid row IDs were found in the selected rows.",
        selectAllError: "Failed to select all matching rows.",
      };
export type BulkFeedbackMessages = ReturnType<typeof bulkFeedbackMessages>;

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

/** Fills `{name}` placeholders; unknown placeholders stay as written. */
export function formatBulkFeedback(
  template: string,
  values: Record<string, number | string>
): string {
  return template.replace(PLACEHOLDER_PATTERN, (match, name: string) =>
    name in values ? String(values[name]) : match
  );
}

/** Picks the singular or plural template for a row count. */
export function countedBulkFeedback(
  one: string,
  many: string,
  count: number
): string {
  return formatBulkFeedback(count === 1 ? one : many, { count });
}

/** Locale defaults with the host's overrides; blank overrides are ignored. */
export function resolveBulkFeedbackMessages(
  locale: string | undefined,
  overrides?: Partial<Record<keyof BulkFeedbackMessages, unknown>>
): BulkFeedbackMessages {
  const messages = bulkFeedbackMessages(locale);
  if (!overrides) {
    return messages;
  }
  for (const key of Object.keys(messages) as (keyof BulkFeedbackMessages)[]) {
    const override = overrides[key];
    if (typeof override === "string" && override.trim().length > 0) {
      messages[key] = override;
    }
  }
  return messages;
}
