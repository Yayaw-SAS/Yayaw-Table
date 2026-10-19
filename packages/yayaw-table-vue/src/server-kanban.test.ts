import { expect, it } from "vitest";
import { createServerKanban, type ServerKanbanState } from "./server-kanban";

it("keeps global counts, independent lane cursors, duplicate suppression and retry position", async () => {
  let state: ServerKanbanState = { lanes: [], loading: true };
  const calls: string[] = [];
  let fail = true;
  const board = createServerKanban(
    {
      queryKey: "owner:1",
      groups: async () => [
        { value: "draft", label: "Draft", totalCount: 55 },
        { value: "done", label: "Done", totalCount: 0 },
      ],
      rows: async (group, cursor) => {
        await Promise.resolve();
        calls.push(`${group}:${cursor}`);
        if (cursor && fail) {
          fail = false;
          throw new Error("offline");
        }
        return cursor
          ? { rows: [{ id: 1 }, { id: 2 }], nextCursor: null }
          : { rows: [{ id: 1 }], nextCursor: "next" };
      },
    },
    (next) => {
      state = next;
    }
  );
  await board.load();
  expect(state.lanes[0]?.totalCount).toBe(55);
  expect(state.lanes[1]?.rows).toEqual([]);
  await board.loadLane("draft");
  expect(state.lanes[0]?.error).toBe("offline");
  expect(state.lanes[0]?.rows).toHaveLength(1);
  await board.loadLane("draft");
  expect(state.lanes[0]?.rows).toHaveLength(2);
  expect(state.lanes[0]?.nextCursor).toBeNull();
  await board.loadLane("draft");
  expect(calls).toEqual(["draft:null", "draft:next", "draft:next"]);
  board.dispose();
});
it("does not publish results from an abandoned account or filter scope", async () => {
  let resolve!: (groups: []) => void;
  let calls = 0;
  const board = createServerKanban(
    {
      queryKey: "old-account",
      groups: () =>
        new Promise((done) => {
          resolve = done;
        }),
      rows: async () => ({ rows: [], nextCursor: null }),
    },
    () => {
      calls++;
    }
  );
  const pending = board.load();
  board.dispose();
  resolve([]);
  await pending;
  expect(calls).toBe(1);
});
it("rejects invalid group counts instead of displaying incomplete totals", async () => {
  let state: ServerKanbanState = { lanes: [], loading: true };
  const board = createServerKanban(
    {
      queryKey: "bad",
      groups: async () => [{ value: "a", label: "A", totalCount: -1 }],
      rows: async () => ({ rows: [], nextCursor: null }),
    },
    (value) => {
      state = value;
    }
  );
  await board.load();
  expect(state.error).toBe("Invalid server board groups.");
  board.dispose();
});

it("keeps cards on failure, retries once, and reloads counts and cursors after a move", async () => {
  let state: ServerKanbanState = { lanes: [], loading: true };
  let moved = false,
    fail = true,
    reads = 0,
    writes = 0;
  const row = { id: 7, status: 1 };
  const board = createServerKanban(
    {
      queryKey: "editable",
      groups: async () => {
        await Promise.resolve();
        reads++;
        return [
          { value: "1", label: "Open", totalCount: moved ? 0 : 2 },
          { value: "2", label: "Done", totalCount: moved ? 1 : 0 },
        ];
      },
      rows: async (group) => ({
        rows:
          group === (moved ? "2" : "1")
            ? [{ ...row, status: moved ? 2 : 1 }]
            : [],
        nextCursor: null,
      }),
    },
    (next) => {
      state = next;
    }
  );
  await board.load();
  const write = async (record: Record<string, unknown>, target: string) => {
    await Promise.resolve();
    writes++;
    expect(record.status).toBe(1);
    expect(target).toBe("2");
    if (fail) {
      throw new Error("Offline");
    }
    moved = true;
  };
  await board.move("7", "1", write);
  await board.move("7", "missing", write);
  await board.move("missing", "2", write);
  expect(writes).toBe(0);
  await board.move("7", "2", write);
  expect(state.moveError).toBe("Offline");
  expect(state.lanes[0]?.rows[0]?.status).toBe(1);
  expect(state.lanes[0]?.totalCount).toBe(2);
  fail = false;
  await board.move("7", "2", write);
  expect(state.moveError).toBeUndefined();
  expect(state.lanes.map((lane) => lane.totalCount)).toEqual([0, 1]);
  expect(state.lanes[1]?.rows[0]?.status).toBe(2);
  expect(row.status).toBe(1);
  expect(reads).toBe(2);
  board.dispose();
});
it("serializes moves and ignores a write completing after a scope change", async () => {
  let state: ServerKanbanState = { lanes: [], loading: true },
    publications = 0,
    writes = 0;
  let complete!: () => void;
  const board = createServerKanban(
    {
      queryKey: "old",
      groups: async () => [
        { value: "a", label: "A", totalCount: 1 },
        { value: "b", label: "B", totalCount: 0 },
      ],
      rows: async () => ({ rows: [{ id: 1 }], nextCursor: null }),
    },
    (next) => {
      state = next;
      publications++;
    }
  );
  await board.load();
  const write = async () => {
    writes++;
    await new Promise<void>((resolve) => {
      complete = resolve;
    });
  };
  const pending = board.move("1", "b", write);
  expect(state.moving).toBe("1");
  await board.move("1", "b", write);
  expect(writes).toBe(1);
  board.dispose();
  const before = publications;
  complete();
  await pending;
  expect(publications).toBe(before);
});
