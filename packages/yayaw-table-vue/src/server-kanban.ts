/** Read-oriented remote boards load each lane independently of grid pagination. */
export interface ServerKanbanGroup {
  value: string;
  label: string;
  totalCount: number;
}
export interface ServerKanbanPage {
  rows: Record<string, unknown>[];
  nextCursor: string | null;
}
export interface ServerKanbanSource {
  /** Change whenever search, filters, sorting, permissions, or refresh identity changes. */
  queryKey: string;
  groups: (signal: AbortSignal) => Promise<ServerKanbanGroup[]>;
  rows: (
    group: string,
    cursor: string | null,
    signal: AbortSignal
  ) => Promise<ServerKanbanPage>;
  getRowId?: (row: Record<string, unknown>) => string;
  onActivate?: (row: Record<string, unknown>) => void;
  labels?: {
    loading?: string;
    retry?: string;
    loadMore?: string;
    empty?: string;
  };
}
export interface ServerKanbanLane extends ServerKanbanGroup {
  rows: Record<string, unknown>[];
  nextCursor: string | null;
  loading: boolean;
  error?: string;
}
export interface ServerKanbanState {
  lanes: ServerKanbanLane[];
  loading: boolean;
  error?: string;
}

/** Every publication is immutable; aborted or superseded reads cannot restore another scope. */
export function createServerKanban(
  source: ServerKanbanSource,
  publish: (state: ServerKanbanState) => void
) {
  let state: ServerKanbanState = { lanes: [], loading: true };
  const controller = new AbortController();
  const id =
    source.getRowId ?? ((row: Record<string, unknown>) => String(row.id));
  const emit = () => {
    if (!controller.signal.aborted) {
      publish(state);
    }
  };
  const patch = (value: string, change: Partial<ServerKanbanLane>) => {
    state = {
      ...state,
      lanes: state.lanes.map((lane) =>
        lane.value === value ? { ...lane, ...change } : lane
      ),
    };
    emit();
  };
  const loadLane = async (value: string) => {
    const lane = state.lanes.find((item) => item.value === value);
    if (
      !lane ||
      lane.loading ||
      (lane.rows.length && lane.nextCursor === null)
    ) {
      return;
    }
    patch(value, { loading: true, error: undefined });
    try {
      const page = await source.rows(value, lane.nextCursor, controller.signal);
      if (controller.signal.aborted) {
        return;
      }
      if (page.nextCursor !== null && page.nextCursor === lane.nextCursor) {
        throw new Error("The server returned a repeated cursor.");
      }
      const rows = new Map(lane.rows.map((row) => [id(row), row]));
      for (const row of page.rows) {
        rows.set(id(row), row);
      }
      patch(value, {
        rows: [...rows.values()],
        nextCursor: page.nextCursor,
        loading: false,
      });
    } catch (cause) {
      patch(value, {
        loading: false,
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  };
  const load = async () => {
    if (controller.signal.aborted) {
      return;
    }
    state = { lanes: [], loading: true };
    emit();
    try {
      const groups = await source.groups(controller.signal);
      if (controller.signal.aborted) {
        return;
      }
      if (
        new Set(groups.map((group) => group.value)).size !== groups.length ||
        groups.some(
          (group) => !Number.isInteger(group.totalCount) || group.totalCount < 0
        )
      ) {
        throw new Error("Invalid server board groups.");
      }
      state = {
        loading: false,
        lanes: groups.map((group) => ({
          ...group,
          rows: [],
          nextCursor: null,
          loading: false,
        })),
      };
      emit();
      await Promise.all(
        groups
          .filter((group) => group.totalCount > 0)
          .map((group) => loadLane(group.value))
      );
    } catch (cause) {
      state = {
        ...state,
        loading: false,
        error: cause instanceof Error ? cause.message : String(cause),
      };
      emit();
    }
  };
  return { load, loadLane, dispose: () => controller.abort() };
}
