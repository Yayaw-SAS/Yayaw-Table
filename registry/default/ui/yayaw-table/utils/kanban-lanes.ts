/**
 * Kanban lane order and visibility, per grouping column. Plain JSON, saved
 * with a view (`kanban.lanes`) or set as the table default
 * (`table.kanban.lanes`). Pure and shared by the React and Vue editions
 * (synced to Vue).
 */

/** Lane order and visibility of one grouping column. */
export interface KanbanLaneSettings {
  /**
   * Stored lane values, first to last. Lanes it does not name follow in their
   * usual order. It orders lanes; it does not create empty ones.
   */
  order?: string[];
  /** Stored values of the lanes not shown. Their cards are not shown either. */
  hidden?: string[];
}

/** Lane settings by grouping column id: each column keeps its own lanes. */
export type KanbanLanes = Record<string, KanbanLaneSettings>;

/** Most lanes one column keeps settings for. */
export const KANBAN_LANE_LIMIT = 200;

/** Most characters of one stored lane value. */
const KANBAN_LANE_TEXT_LIMIT = 500;

/** Keys never copied: they could reach an object's prototype. */
const UNSAFE_KEYS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Distinct lane values (empty text is the lane without a value). */
function laneValues(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return;
  }
  const values: string[] = [];
  for (const item of value) {
    if (values.length >= KANBAN_LANE_LIMIT) {
      break;
    }
    if (
      typeof item === "string" &&
      item.length <= KANBAN_LANE_TEXT_LIMIT &&
      !values.includes(item)
    ) {
      values.push(item);
    }
  }
  return values;
}

/** One column's settings, or undefined when they keep nothing. */
export function normalizeKanbanLaneSettings(
  value: unknown
): KanbanLaneSettings | undefined {
  if (!isRecord(value)) {
    return;
  }
  const settings: KanbanLaneSettings = {};
  const order = laneValues(value.order);
  if (order?.length) {
    settings.order = order;
  }
  const hidden = laneValues(value.hidden);
  if (hidden?.length) {
    settings.hidden = hidden;
  }
  return settings.order || settings.hidden ? settings : undefined;
}

/** Lane settings by column, keeping only well-formed ones; undefined when empty. */
export function normalizeKanbanLanes(value: unknown): KanbanLanes | undefined {
  if (!isRecord(value)) {
    return;
  }
  const lanes: KanbanLanes = {};
  for (const [column, settings] of Object.entries(value)) {
    const id = column.trim();
    if (!id || UNSAFE_KEYS.has(id) || id.length > KANBAN_LANE_TEXT_LIMIT) {
      continue;
    }
    const normalized = normalizeKanbanLaneSettings(settings);
    if (normalized) {
      lanes[id] = normalized;
    }
  }
  return Object.keys(lanes).length ? lanes : undefined;
}

/**
 * The lanes in effect: the view's settings for a column replace the table
 * default's for that column; other columns keep the default's.
 */
export function mergeKanbanLanes(
  defaults: KanbanLanes | undefined,
  override: KanbanLanes | undefined
): KanbanLanes | undefined {
  return normalizeKanbanLanes({ ...defaults, ...override });
}

/** The settings of one grouping column. */
export function kanbanLaneSettings(
  lanes: KanbanLanes | undefined,
  column: string
): KanbanLaneSettings {
  return column && lanes && Object.hasOwn(lanes, column)
    ? (lanes[column] ?? {})
    : {};
}

/**
 * Lanes in their order: the ones `order` names first, then the others in
 * their usual order. Hidden lanes are returned apart.
 */
export function arrangeKanbanLanes<TLane extends { value: string }>(
  lanes: readonly TLane[],
  settings: KanbanLaneSettings | undefined
): { visible: TLane[]; hidden: TLane[] } {
  const order = settings?.order ?? [];
  const hiddenValues = new Set(settings?.hidden ?? []);
  const rank = new Map(order.map((value, index) => [value, index]));
  const sorted = lanes
    .map((lane, index) => ({ lane, index }))
    .sort((left, right) => {
      const leftRank = rank.get(left.lane.value) ?? order.length + left.index;
      const rightRank =
        rank.get(right.lane.value) ?? order.length + right.index;
      return leftRank - rightRank;
    })
    .map(({ lane }) => lane);
  return {
    visible: sorted.filter((lane) => !hiddenValues.has(lane.value)),
    hidden: sorted.filter((lane) => hiddenValues.has(lane.value)),
  };
}

/**
 * Settings after moving one lane by `offset` among `lanes` (every lane the
 * board knows, shown or not, in their current order). The order then names
 * every lane, so it stays as arranged when other values appear.
 */
export function moveKanbanLane(
  settings: KanbanLaneSettings | undefined,
  lanes: readonly string[],
  value: string,
  offset: number
): KanbanLaneSettings {
  const current = arrangeKanbanLanes(
    lanes.map((lane) => ({ value: lane })),
    { order: settings?.order }
  ).visible.map((lane) => lane.value);
  const from = current.indexOf(value);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= current.length) {
    return { ...settings };
  }
  const order = [...current];
  order.splice(from, 1);
  order.splice(to, 0, value);
  return normalizeKanbanLaneSettings({ ...settings, order }) ?? {};
}

/** Settings after showing or hiding one lane. */
export function setKanbanLaneHidden(
  settings: KanbanLaneSettings | undefined,
  value: string,
  hidden: boolean
): KanbanLaneSettings {
  const others = (settings?.hidden ?? []).filter((item) => item !== value);
  return (
    normalizeKanbanLaneSettings({
      ...settings,
      hidden: hidden ? [...others, value] : others,
    }) ?? {}
  );
}

/** Lanes by column after replacing one column's settings (empty ones are removed). */
export function withKanbanLaneSettings(
  lanes: KanbanLanes | undefined,
  column: string,
  settings: KanbanLaneSettings | undefined
): KanbanLanes | undefined {
  const next: Record<string, unknown> = { ...lanes };
  Reflect.deleteProperty(next, column);
  const normalized = normalizeKanbanLaneSettings(settings);
  if (normalized) {
    next[column] = normalized;
  }
  return normalizeKanbanLanes(next);
}

/**
 * Lanes the settings can arrange before the board loads them: the column's
 * options, the values of `rows`, then values the settings name. Values stay
 * as stored; `label` reads them for people.
 */
export function kanbanLaneCandidates({
  label,
  options,
  settings,
  values,
}: {
  label: (value: string) => string;
  options?: readonly unknown[];
  settings?: KanbanLaneSettings;
  values?: readonly string[];
}): { value: string; label: string }[] {
  const known = new Map<string, string>();
  const add = (value: string, text?: string) => {
    if (!known.has(value) && known.size < KANBAN_LANE_LIMIT) {
      known.set(value, text || label(value));
    }
  };
  for (const option of options ?? []) {
    if (isRecord(option) && option.value !== undefined) {
      add(
        String(option.value),
        typeof option.label === "string" ? option.label : undefined
      );
    } else if (typeof option === "string") {
      add(option);
    }
  }
  for (const value of values ?? []) {
    add(value);
  }
  for (const value of [
    ...(settings?.order ?? []),
    ...(settings?.hidden ?? []),
  ]) {
    add(value);
  }
  return arrangeKanbanLanes(
    [...known].map(([value, text]) => ({ value, label: text })),
    { order: settings?.order }
  ).visible;
}
