import type { ServerKanbanSource } from "../src/components/ui/yayaw-table/utils/server-kanban";

/** Deterministic remote-lane fixture: totals intentionally exceed one page. */
export function exampleServerKanban(
  onActivate: ServerKanbanSource["onActivate"]
): ServerKanbanSource & {
  update: (
    id: string,
    values: Record<string, unknown>
  ) => Promise<{ success: boolean; error?: string }>;
} {
  let failed = false,
    moveFailed = false;
  const records = [
    "working",
    "working",
    "working",
    "working",
    "working",
    "done",
  ].map((stage, index) => ({
    id: String(index + 1),
    name: `Record ${index + 1}`,
    owner: "Morgan",
    url: "https://example.com",
    stage,
  }));
  return {
    queryKey: "server-board-demo",
    onActivate,
    update: async (id, values) => {
      await Promise.resolve();
      if (values.stage === "empty" && !moveFailed) {
        moveFailed = true;
        return {
          success: false,
          error: "Demo move interrupted. Retry the move.",
        };
      }
      const record = records.find((row) => row.id === id);
      if (!record) {
        return { success: false };
      }
      record.stage = String(values.stage);
      return { success: true };
    },
    groups: async () =>
      [
        { value: "working", label: "In progress" },
        { value: "done", label: "Complete" },
        { value: "empty", label: "Waiting" },
      ].map((group) => ({
        ...group,
        totalCount: records.filter((row) => row.stage === group.value).length,
      })),
    rows: async (group, cursor) => {
      await Promise.resolve();
      if (cursor === "2" && !failed) {
        failed = true;
        throw new Error("Demo connection interrupted. Retry this lane.");
      }
      const rows = records.filter((row) => row.stage === group);
      const count = rows.length;
      const offset = Number(cursor ?? 0);
      return {
        rows: rows.slice(offset, offset + 2).map((row) => ({ ...row })),
        nextCursor: offset + 2 < count ? String(offset + 2) : null,
      };
    },
  };
}
