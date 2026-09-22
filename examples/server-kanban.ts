import type { ServerKanbanSource } from "../src/components/ui/yayaw-table/utils/server-kanban";

/** Deterministic remote-lane fixture: totals intentionally exceed one page. */
export function exampleServerKanban(
  onActivate: ServerKanbanSource["onActivate"]
): ServerKanbanSource {
  let failed = false;
  return {
    queryKey: "server-board-demo",
    onActivate,
    groups: async () => [
      { value: "working", label: "In progress", totalCount: 5 },
      { value: "done", label: "Complete", totalCount: 1 },
      { value: "empty", label: "Waiting", totalCount: 0 },
    ],
    rows: async (group, cursor) => {
      await Promise.resolve();
      if (cursor === "2" && !failed) {
        failed = true;
        throw new Error("Demo connection interrupted. Retry this lane.");
      }
      const count = group === "working" ? 5 : 1;
      const offset = Number(cursor ?? 0);
      return {
        rows: Array.from(
          { length: Math.min(2, count - offset) },
          (_, index) => ({
            id: `${group}-${offset + index}`,
            name: `Record ${offset + index + 1}`,
            owner: "Morgan",
            stage: group,
          })
        ),
        nextCursor: offset + 2 < count ? String(offset + 2) : null,
      };
    },
  };
}
