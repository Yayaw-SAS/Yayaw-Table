type RecordData = Record<string, unknown>;
interface DuplicateResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export function duplicateLabels(locale: string, count: number) {
  const french = locale.startsWith("fr");
  const plural =
    new Intl.PluralRules(french ? "fr" : "en").select(count) !== "one";
  return {
    success: french
      ? `${count} élément${plural ? "s" : ""} dupliqué${plural ? "s" : ""}`
      : `${count} record${plural ? "s" : ""} duplicated`,
    error: french
      ? "La duplication a échoué. Les éléments non dupliqués restent sélectionnés."
      : "Duplication failed. Records that were not duplicated remain selected.",
  };
}

/** Run the existing host duplicate action once per permitted selected record. */
export function createSelectionDuplicate(options: {
  rows: () => readonly RecordData[];
  getId: (row: RecordData) => string;
  canDuplicate: (row: RecordData) => boolean;
  action: () =>
    | ((id: string) => DuplicateResult | Promise<DuplicateResult>)
    | undefined;
  refresh: () => Promise<unknown>;
  select: (rows: RecordData[]) => void;
  success: (count: number) => void;
  error: (message?: string) => void;
}) {
  let pending = false;
  return async () => {
    const action = options.action();
    const selected = [
      ...new Map(
        options.rows().map((row) => [options.getId(row), row])
      ).values(),
    ];
    if (
      pending ||
      !action ||
      !selected.length ||
      selected.some((row) => !options.canDuplicate(row))
    ) {
      return;
    }
    pending = true;
    const { copies, completed, failed } = await duplicateRecords(
      selected,
      action,
      options
    );
    try {
      if (completed) {
        await options.refresh();
        options.select([...copies, ...selected.slice(completed)]);
      }
      if (!failed) {
        options.success(completed);
      }
    } catch (cause) {
      options.error(cause instanceof Error ? cause.message : undefined);
    } finally {
      pending = false;
    }
  };
}

async function duplicateRecords(
  selected: RecordData[],
  action: (id: string) => DuplicateResult | Promise<DuplicateResult>,
  options: Pick<
    Parameters<typeof createSelectionDuplicate>[0],
    "getId" | "error"
  >
) {
  const copies: RecordData[] = [];
  let completed = 0;
  let failed = false;
  try {
    for (const row of selected) {
      const result = await action(options.getId(row));
      if (!result.success) {
        failed = true;
        options.error(result.error);
        break;
      }
      completed += 1;
      if (
        result.data &&
        typeof result.data === "object" &&
        !Array.isArray(result.data)
      ) {
        copies.push(result.data as RecordData);
      }
    }
  } catch (cause) {
    failed = true;
    options.error(cause instanceof Error ? cause.message : undefined);
  }
  return { copies, completed, failed };
}
