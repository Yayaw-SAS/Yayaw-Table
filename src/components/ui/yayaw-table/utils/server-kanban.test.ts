import { expect, it } from "bun:test";
import { createServerKanban, type ServerKanbanState } from "./server-kanban";

it("keeps global counts, independent lane cursors, duplicate suppression and retry position", async () => {
 let state: ServerKanbanState = { lanes: [], loading: true };
 const calls: string[] = []; let fail = true;
 const board = createServerKanban({ queryKey: "owner:1", groups: async () => [{ value: "draft", label: "Draft", totalCount: 55 }, { value: "done", label: "Done", totalCount: 0 }], rows: async (group, cursor) => { await Promise.resolve();
 calls.push(`${group}:${cursor}`);
 if (cursor && fail) { fail = false; throw new Error("offline"); }
 return cursor ? { rows: [{ id: 1 }, { id: 2 }], nextCursor: null } : { rows: [{ id: 1 }], nextCursor: "next" };
 } }, next => { state = next; });
 await board.load(); expect(state.lanes[0]?.totalCount).toBe(55); expect(state.lanes[1]?.rows).toEqual([]);
 await board.loadLane("draft"); expect(state.lanes[0]?.error).toBe("offline"); expect(state.lanes[0]?.rows).toHaveLength(1);
 await board.loadLane("draft"); expect(state.lanes[0]?.rows).toHaveLength(2); expect(state.lanes[0]?.nextCursor).toBeNull();
 await board.loadLane("draft"); expect(calls).toEqual(["draft:null", "draft:next", "draft:next"]);
 board.dispose();
});
it("does not publish results from an abandoned account or filter scope", async () => {
 let resolve!: (groups: []) => void; let calls = 0;
 const board = createServerKanban({ queryKey: "old-account", groups: () => new Promise(done => { resolve = done; }), rows: async () => ({ rows: [], nextCursor: null }) }, () => { calls++; });
 const pending = board.load(); board.dispose(); resolve([]); await pending; expect(calls).toBe(1);
});
it("rejects invalid group counts instead of displaying incomplete totals", async () => {
 let state: ServerKanbanState = { lanes: [], loading: true };
 const board = createServerKanban({ queryKey: "bad", groups: async () => [{ value: "a", label: "A", totalCount: -1 }], rows: async () => ({ rows: [], nextCursor: null }) }, value => { state = value; });
 await board.load(); expect(state.error).toBe("Invalid server board groups."); board.dispose();
});
