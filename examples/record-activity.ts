import type { TableActivityRecord } from "../src/components/ui/yayaw-table/utils/activity-shortcuts";
import type {
  DetailActivity,
  DetailRecord,
  DetailRevertHandler,
} from "../src/components/ui/yayaw-table/utils/record-details";

/** Demo-only storage. Applications persist these events and authorize inverses on the server. */
export function createRecordActivity(
  initial: DetailRecord[],
  publish: (rows: DetailRecord[]) => void
) {
  const records = structuredClone(initial);
  const history: TableActivityRecord[] = records.map((row) => ({
    row,
    activity: [],
  }));
  const refresh = () =>
    publish(
      history
        .filter((item) => !item.row.deletedAt)
        .map((item) => ({ ...item.row }))
    );
  const update = (id: string, values: DetailRecord, transactionId?: string) => {
    const record = history.find((item) => item.row.id === id);
    if (!record) {
      return Promise.resolve({ success: false, error: "Record not found" });
    }
    const changes = Object.entries(values)
      .filter(([field, after]) => record.row[field] !== after)
      .map(([field, after]) => ({ field, before: record.row[field], after }));
    const entry: DetailActivity = {
      id: crypto.randomUUID(),
      actor: { name: "Demo user" },
      at: new Date().toISOString(),
      action: values.deletedAt ? "Trash" : "Update",
      reversible: true,
      transactionId,
      changes,
    };
    record.activity = [entry, ...record.activity];
    record.row = { ...record.row, ...values };
    refresh();
    return Promise.resolve({ success: true });
  };
  const revert: DetailRevertHandler = (row, entry) => {
    const record = history.find((item) => item.row.id === row.id);
    const changes = entry.changes ?? [];
    if (
      !record ||
      record.activity.some((item) => item.reverts === entry.id) ||
      changes.some((change) => record.row[change.field] !== change.after)
    ) {
      return {
        success: false,
        error: "This record has changed. Refresh and try again.",
      };
    }
    record.row = {
      ...record.row,
      ...Object.fromEntries(
        changes.map((change) => [change.field, change.before])
      ),
    };
    record.activity = [
      {
        id: crypto.randomUUID(),
        actor: { name: "Demo user" },
        at: new Date().toISOString(),
        action: "Undo",
        reverts: entry.id,
        reversible: false,
        changes: changes.map((change) => ({
          ...change,
          before: change.after,
          after: change.before,
        })),
      },
      ...record.activity,
    ];
    refresh();
    return { success: true };
  };
  return {
    history: () => history,
    revert,
    update: (id: string, values: DetailRecord) => update(id, values),
    duplicate: (id: string) => {
      const source = history.find(
        (item) => item.row.id === id && !item.row.deletedAt
      );
      if (!source) {
        return Promise.resolve({ success: false, error: "Record not found" });
      }
      const row = {
        ...source.row,
        id: crypto.randomUUID(),
        name: `${source.row.name} (copy)`,
      };
      history.push({ row, activity: [] });
      refresh();
      return Promise.resolve({ success: true, data: row });
    },
    create: (values: DetailRecord) => {
      history.push({
        row: { ...values, id: crypto.randomUUID() },
        activity: [],
      });
      refresh();
      return Promise.resolve({ success: true });
    },
    delete: (id: string) => update(id, { deletedAt: new Date().toISOString() }),
    bulkUpdate: async (ids: string[], values: DetailRecord) => {
      const transactionId = crypto.randomUUID();
      for (const id of ids) {
        await update(id, values, transactionId);
      }
      return { success: true };
    },
  };
}
