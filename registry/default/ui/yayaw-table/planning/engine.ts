import {
  addWorkingDays,
  dateDay,
  dayDate,
  seekWorkingDay,
  taskCalendar,
  workingDuration,
} from "./calendar";
import {
  type PlanningChange,
  type PlanningDependency,
  PlanningError,
  type PlanningMutation,
  type PlanningPreview,
  type PlanningRef,
  type PlanningSnapshot,
  type PlanningTask,
  planningKey,
  type TablePlanningConfig,
} from "./types";

export function planningDefaults(
  config: TablePlanningConfig
): Required<TablePlanningConfig> {
  return {
    ...config,
    allowDateEdit: config.allowDateEdit ?? true,
    allowDependencyEdit: config.allowDependencyEdit ?? true,
    allowHierarchyEdit: config.allowHierarchyEdit ?? true,
    allowCrossTableDependencies: config.allowCrossTableDependencies ?? true,
    allowSummaryMove: config.allowSummaryMove ?? true,
    hierarchy: config.hierarchy ?? true,
    parentDates: config.parentDates ?? "rollup",
    dependencyTypes: config.dependencyTypes ?? ["FS", "SS", "FF", "SF"],
    scheduling: config.scheduling ?? "preview",
    maxCalendarSearchDays: config.maxCalendarSearchDays ?? 36_600,
  };
}
interface Index {
  tasks: Map<string, PlanningTask>;
  children: Map<string, PlanningTask[]>;
  order: Map<string, number>;
}
const isRollup = (config: TablePlanningConfig): boolean =>
  config.hierarchy !== false && config.parentDates !== "independent";

function validateCalendars(
  snapshot: PlanningSnapshot,
  config: TablePlanningConfig
): void {
  const sourceIds = new Set(snapshot.sources.map((source) => source.id));
  const calendarIds = new Set(
    snapshot.calendars.map((calendar) => calendar.id)
  );
  if (
    sourceIds.size !== snapshot.sources.length ||
    calendarIds.size !== snapshot.calendars.length
  ) {
    throw new PlanningError(
      "duplicate-identity",
      "Source and calendar IDs must be unique."
    );
  }
  const limit = config.maxCalendarSearchDays ?? 36_600;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 366_000) {
    throw new PlanningError(
      "invalid-horizon",
      "The calendar search horizon must be between 1 and 366000 days."
    );
  }
  for (const calendar of snapshot.calendars) {
    if (
      !calendar.id ||
      calendar.workingDays.some(
        (day) => !Number.isInteger(day) || day < 0 || day > 6
      )
    ) {
      throw new PlanningError(
        "invalid-calendar",
        "Working weekdays must be integers between 0 and 6."
      );
    }
    for (const [date, working] of Object.entries(calendar.exceptions ?? {})) {
      dateDay(date);
      if (typeof working !== "boolean") {
        throw new PlanningError(
          "invalid-calendar",
          "Calendar exceptions must be booleans."
        );
      }
    }
  }
}
type Connect = (from: string, to: string) => void;
function indexTasks(
  snapshot: PlanningSnapshot,
  tasks: Map<string, PlanningTask>,
  indegree: Map<string, number>,
  connect: Connect
): void {
  for (const task of snapshot.tasks) {
    const key = planningKey(task.ref);
    if (!(task.ref.id && task.ref.source) || tasks.has(key)) {
      throw new PlanningError(
        "duplicate-task",
        "Every task needs a unique source and record ID."
      );
    }
    tasks.set(key, task);
    indegree.set(`${key}:in`, 0);
    indegree.set(`${key}:out`, 0);
    connect(`${key}:in`, `${key}:out`);
    if ((task.start == null) !== (task.end == null)) {
      throw new PlanningError(
        "incomplete-dates",
        `Both dates are required for ${task.label}.`
      );
    }
    if (
      task.start != null &&
      task.end != null &&
      dateDay(task.end) < dateDay(task.start)
    ) {
      throw new PlanningError(
        "invalid-duration",
        `Reversed dates for ${task.label}.`
      );
    }
    taskCalendar(task, snapshot);
  }
}
function indexHierarchy(
  snapshot: PlanningSnapshot,
  config: TablePlanningConfig,
  tasks: Map<string, PlanningTask>,
  children: Map<string, PlanningTask[]>,
  connect: Connect
): void {
  for (const task of snapshot.tasks) {
    if (!task.parent) {
      continue;
    }
    const parentKey = planningKey(task.parent);
    if (!tasks.has(parentKey)) {
      throw new PlanningError(
        "missing-parent",
        `The parent of ${task.label} is unavailable.`
      );
    }
    const group = children.get(parentKey) ?? [];
    group.push(task);
    children.set(parentKey, group);
    const seen = new Set([planningKey(task.ref)]);
    let current: PlanningTask | undefined = tasks.get(parentKey);
    while (current) {
      const key = planningKey(current.ref);
      if (seen.has(key)) {
        throw new PlanningError(
          "hierarchy-cycle",
          "The hierarchy contains a cycle."
        );
      }
      seen.add(key);
      current = current.parent
        ? tasks.get(planningKey(current.parent))
        : undefined;
    }
    if (isRollup(config)) {
      const key = planningKey(task.ref);
      connect(`${parentKey}:in`, `${key}:in`);
      connect(`${key}:out`, `${parentKey}:out`);
    }
  }
}
function indexDependencies(
  snapshot: PlanningSnapshot,
  tasks: Map<string, PlanningTask>,
  connect: Connect
): void {
  const ids = new Set<string>();
  for (const dependency of snapshot.dependencies) {
    const from = planningKey(dependency.from);
    const to = planningKey(dependency.to);
    if (!dependency.id || ids.has(dependency.id)) {
      throw new PlanningError(
        "duplicate-dependency",
        "Dependency IDs must be unique."
      );
    }
    ids.add(dependency.id);
    if (!(tasks.has(from) && tasks.has(to))) {
      throw new PlanningError(
        "missing-task",
        "A dependency references an unavailable task."
      );
    }
    if (from === to) {
      throw new PlanningError(
        "dependency-cycle",
        "A task cannot depend on itself."
      );
    }
    if (
      !(
        ["FS", "SS", "FF", "SF"].includes(dependency.type) &&
        Number.isSafeInteger(dependency.lag ?? 0)
      )
    ) {
      throw new PlanningError(
        "invalid-dependency",
        "A dependency needs a supported type and a whole-day offset."
      );
    }
    if (
      dependency.lagUnit &&
      !["workingDays", "calendarDays"].includes(dependency.lagUnit)
    ) {
      throw new PlanningError(
        "invalid-dependency",
        "Unknown dependency calendar unit."
      );
    }
    connect(`${from}:out`, `${to}:in`);
  }
}
function topologicalOrder(
  indegree: Map<string, number>,
  edges: Map<string, Set<string>>
): Map<string, number> {
  const queue = [...indegree]
    .filter(([, count]) => count === 0)
    .map(([key]) => key);
  const order = new Map<string, number>();
  for (let i = 0; i < queue.length; i += 1) {
    const key = queue[i];
    if (key === undefined) {
      continue;
    }
    order.set(key, i);
    for (const next of edges.get(key) ?? []) {
      const count = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, count);
      if (!count) {
        queue.push(next);
      }
    }
  }
  if (order.size !== indegree.size) {
    throw new PlanningError(
      "dependency-cycle",
      "Dependencies contain a cycle, including an ancestor or group relationship."
    );
  }
  return order;
}

/** Split task entry/exit nodes encode group constraints without quadratic leaf expansion. */
export function indexPlanning(
  snapshot: PlanningSnapshot,
  config: TablePlanningConfig
): Index {
  validateCalendars(snapshot, config);
  const tasks = new Map<string, PlanningTask>();
  const children = new Map<string, PlanningTask[]>();
  const edges = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();
  const connect = (from: string, to: string): void => {
    const destinations = edges.get(from) ?? new Set<string>();
    if (!destinations.has(to)) {
      destinations.add(to);
      indegree.set(to, (indegree.get(to) ?? 0) + 1);
    }
    edges.set(from, destinations);
  };
  indexTasks(snapshot, tasks, indegree, connect);
  indexHierarchy(snapshot, config, tasks, children, connect);
  indexDependencies(snapshot, tasks, connect);
  const order = topologicalOrder(indegree, edges);
  return { tasks, children, order };
}

function rollupDates(index: Index, config: TablePlanningConfig): void {
  if (!isRollup(config)) {
    return;
  }
  const sorted = [...index.tasks.values()].sort(
    (a, b) =>
      (index.order.get(`${planningKey(a.ref)}:out`) ?? 0) -
      (index.order.get(`${planningKey(b.ref)}:out`) ?? 0)
  );
  for (const task of sorted) {
    const children = index.children.get(planningKey(task.ref));
    if (!children?.length) {
      continue;
    }
    // Unknown descendant dates must not produce a misleading partial summary.
    if (children.some((child) => !(child.start && child.end))) {
      task.start = null;
      task.end = null;
      continue;
    }
    task.start = dayDate(
      Math.min(...children.map((child) => dateDay(child.start as string)))
    );
    task.end = dayDate(
      Math.max(...children.map((child) => dateDay(child.end as string)))
    );
  }
}
export function resolvedPlanningSnapshot(
  snapshot: PlanningSnapshot,
  config: TablePlanningConfig
): PlanningSnapshot {
  const copy = structuredClone(snapshot);
  rollupDates(indexPlanning(copy, config), config);
  syncRecords(copy);
  return copy;
}
function requireTask(index: Index, ref: PlanningRef): PlanningTask {
  const task = index.tasks.get(planningKey(ref));
  if (!task) {
    throw new PlanningError(
      "missing-task",
      "The requested task is unavailable."
    );
  }
  return task;
}
function requireEditable(task: PlanningTask): void {
  if (task.editable === false) {
    throw new PlanningError(
      "permission-denied",
      `Changes to ${task.label} are not permitted.`
    );
  }
}
function requireFlag(value: boolean | undefined): void {
  if (value === false) {
    throw new PlanningError(
      "feature-disabled",
      "This planning operation is disabled."
    );
  }
}
function requireDates(task: PlanningTask): [number, number] {
  if (!(task.start && task.end)) {
    throw new PlanningError(
      "unscheduled-task",
      `Schedule ${task.label} before recalculating its dependencies.`
    );
  }
  return [dateDay(task.start), dateDay(task.end)];
}

function moveTask(
  task: PlanningTask,
  days: number,
  snapshot: PlanningSnapshot,
  index: Index,
  config: Required<TablePlanningConfig>
): void {
  if (
    !Number.isSafeInteger(days) ||
    Math.abs(days) > config.maxCalendarSearchDays
  ) {
    throw new PlanningError(
      "invalid-duration",
      "A move must use a bounded whole-day offset."
    );
  }
  requireEditable(task);
  const children = isRollup(config)
    ? index.children.get(planningKey(task.ref))
    : undefined;
  if (children?.length) {
    requireFlag(config.allowSummaryMove);
    for (const child of children) {
      moveTask(child, days, snapshot, index, config);
    }
    rollupDates(index, config);
    return;
  }
  const [start, end] = requireDates(task);
  const calendar = taskCalendar(task, snapshot);
  const duration = workingDuration(
    start,
    end,
    calendar,
    config.maxCalendarSearchDays
  );
  const next = seekWorkingDay(
    start + days,
    1,
    calendar,
    config.maxCalendarSearchDays
  );
  task.start = dayDate(next);
  task.end = dayDate(
    addWorkingDays(next, duration - 1, calendar, config.maxCalendarSearchDays)
  );
}

function mutateRecordParent(
  patch: Record<string, unknown>,
  field: string,
  task: PlanningTask,
  snapshot: PlanningSnapshot,
  index: Index,
  config: Required<TablePlanningConfig>
): void {
  const value = patch[field];
  if (value != null && typeof value !== "string" && typeof value !== "number") {
    throw new PlanningError(
      "invalid-parent",
      "Record parent values must be IDs or null; use a parent mutation for cross-source references."
    );
  }
  mutateTask(
    {
      type: "parent",
      ref: task.ref,
      parent:
        value == null || value === ""
          ? null
          : { source: task.ref.source, id: String(value) },
    },
    snapshot,
    index,
    config
  );
}
function validateRecordDates(start: unknown, end: unknown): void {
  if (
    (start != null && typeof start !== "string") ||
    (end != null && typeof end !== "string")
  ) {
    throw new PlanningError(
      "invalid-date",
      "Mapped planning fields require civil dates or null."
    );
  }
}
function mutateRecord(
  mutation: Extract<PlanningMutation, { type: "record" }>,
  task: PlanningTask,
  snapshot: PlanningSnapshot,
  index: Index,
  config: Required<TablePlanningConfig>
): void {
  const fields = snapshot.sources.find(
    (source) => source.id === task.ref.source
  )?.fields;
  if (!fields) {
    throw new PlanningError(
      "missing-fields",
      "Record editing requires source field mappings."
    );
  }
  // Match JSON transport semantics: undefined means omitted, null clears a field.
  const patch = Object.fromEntries(
    Object.entries(mutation.patch).filter(([, value]) => value !== undefined)
  );
  if (fields.parent && Object.hasOwn(patch, fields.parent)) {
    mutateRecordParent(patch, fields.parent, task, snapshot, index, config);
  }
  if (Object.hasOwn(patch, fields.start) || Object.hasOwn(patch, fields.end)) {
    const start = Object.hasOwn(patch, fields.start)
      ? patch[fields.start]
      : task.start;
    const end = Object.hasOwn(patch, fields.end) ? patch[fields.end] : task.end;
    validateRecordDates(start, end);
    mutateTask(
      {
        type: "dates",
        ref: task.ref,
        start: start as string | null,
        end: end as string | null,
      },
      snapshot,
      index,
      config
    );
  }
  if (fields.calendar && Object.hasOwn(patch, fields.calendar)) {
    requireFlag(config.allowDateEdit);
    const calendarId = patch[fields.calendar];
    if (calendarId != null && typeof calendarId !== "string") {
      throw new PlanningError(
        "missing-calendar",
        "Calendar IDs must be strings."
      );
    }
    task.calendarId = calendarId as string | undefined;
    taskCalendar(task, snapshot);
  }
  task.record = { ...task.record, ...patch };
  if (fields.title && Object.hasOwn(patch, fields.title)) {
    task.label = String(patch[fields.title] ?? "");
  }
}
function mutateTask(
  mutation: Exclude<
    PlanningMutation,
    { type: "dependency.put" | "dependency.remove" }
  >,
  snapshot: PlanningSnapshot,
  index: Index,
  config: Required<TablePlanningConfig>
): void {
  const task = requireTask(index, mutation.ref);
  requireEditable(task);
  if (mutation.type === "parent") {
    requireFlag(config.allowHierarchyEdit);
    requireFlag(config.hierarchy);
    if (mutation.parent) {
      requireEditable(requireTask(index, mutation.parent));
    }
    task.parent = mutation.parent;
    return;
  }
  if (mutation.type === "record") {
    mutateRecord(mutation, task, snapshot, index, config);
    return;
  }
  requireFlag(config.allowDateEdit);
  if (mutation.type === "move") {
    moveTask(task, mutation.days, snapshot, index, config);
    return;
  }
  const group = isRollup(config) && index.children.has(planningKey(task.ref));
  if (group) {
    const [start, end] = requireDates(task);
    if (
      !(mutation.start && mutation.end) ||
      dateDay(mutation.end) - dateDay(mutation.start) !== end - start
    ) {
      throw new PlanningError(
        "summary-resize",
        "Move the group or edit its children to change a summary duration."
      );
    }
    moveTask(task, dateDay(mutation.start) - start, snapshot, index, config);
    return;
  }
  if ((mutation.start == null) !== (mutation.end == null)) {
    throw new PlanningError(
      "incomplete-dates",
      "Provide both dates or clear both dates."
    );
  }
  if (mutation.start && mutation.end) {
    workingDuration(
      dateDay(mutation.start),
      dateDay(mutation.end),
      taskCalendar(task, snapshot),
      config.maxCalendarSearchDays
    );
  }
  task.start = mutation.start;
  task.end = mutation.end;
}

function dependencyBound(
  dependency: PlanningDependency,
  from: PlanningTask,
  to: PlanningTask,
  snapshot: PlanningSnapshot,
  config: Required<TablePlanningConfig>
): number {
  const [start, end] = requireDates(from);
  const calendar = taskCalendar(to, snapshot);
  // Finish boundaries are exclusive internally. Public end dates remain inclusive.
  const sourceBoundary = dependency.type[0] === "F" ? end + 1 : start;
  const endpoint = sourceBoundary - (dependency.type[1] === "F" ? 1 : 0);
  const lag = dependency.lag ?? 0;
  if (dependency.lagUnit === "calendarDays") {
    return seekWorkingDay(
      endpoint + lag,
      1,
      calendar,
      config.maxCalendarSearchDays
    );
  }
  return addWorkingDays(
    seekWorkingDay(endpoint, 1, calendar, config.maxCalendarSearchDays),
    lag,
    calendar,
    config.maxCalendarSearchDays
  );
}
function syncRecords(snapshot: PlanningSnapshot): void {
  for (const task of snapshot.tasks) {
    const fields = snapshot.sources.find(
      (source) => source.id === task.ref.source
    )?.fields;
    if (!(fields && task.record)) {
      continue;
    }
    task.record[fields.start] = task.start;
    task.record[fields.end] = task.end;
    if (fields.parent) {
      // Scalar columns can only represent parents from the same source.
      task.record[fields.parent] =
        task.parent?.source === task.ref.source ? task.parent.id : null;
    }
    if (fields.calendar) {
      task.record[fields.calendar] = task.calendarId ?? null;
    }
  }
}
function mutateDependency(
  mutation: Extract<
    PlanningMutation,
    { type: "dependency.put" | "dependency.remove" }
  >,
  next: PlanningSnapshot,
  index: Index,
  config: Required<TablePlanningConfig>
): void {
  requireFlag(config.allowDependencyEdit);
  const existing = next.dependencies.find(
    (item) =>
      item.id ===
      (mutation.type === "dependency.put"
        ? mutation.dependency.id
        : mutation.id)
  );
  if (existing) {
    requireEditable(requireTask(index, existing.from));
    requireEditable(requireTask(index, existing.to));
  }
  if (mutation.type === "dependency.remove") {
    if (!existing) {
      throw new PlanningError(
        "missing-dependency",
        "The dependency no longer exists."
      );
    }
    next.dependencies = next.dependencies.filter(
      (item) => item.id !== mutation.id
    );
  } else {
    const dependency = structuredClone(mutation.dependency);
    if (!config.dependencyTypes.includes(dependency.type)) {
      throw new PlanningError(
        "feature-disabled",
        "This dependency type is disabled."
      );
    }
    if (
      !config.allowCrossTableDependencies &&
      dependency.from.source !== dependency.to.source
    ) {
      throw new PlanningError(
        "feature-disabled",
        "Cross-table dependencies are disabled."
      );
    }
    requireEditable(requireTask(index, dependency.from));
    requireEditable(requireTask(index, dependency.to));
    next.dependencies = next.dependencies.filter(
      (item) => item.id !== dependency.id
    );
    next.dependencies.push(dependency);
  }
}
function moveGroupToBound(
  task: PlanningTask,
  dependency: PlanningDependency,
  bound: number,
  snapshot: PlanningSnapshot,
  index: Index,
  config: Required<TablePlanningConfig>
): void {
  const [initialStart] = requireDates(task);
  let [start, end] = requireDates(task);
  let endpoint = dependency.type[1] === "F" ? end : start;
  // A holiday can shorten the elapsed span while preserving working duration.
  // Recheck the actual group boundary instead of assuming a calendar translation.
  while (endpoint < bound) {
    moveTask(task, bound - endpoint, snapshot, index, config);
    [start, end] = requireDates(task);
    if (start - initialStart > config.maxCalendarSearchDays) {
      throw new PlanningError(
        "calendar-exhausted",
        "The group cannot satisfy its dependency within the planning horizon."
      );
    }
    endpoint = dependency.type[1] === "F" ? end : start;
  }
}
function satisfyDependency(
  dependency: PlanningDependency,
  next: PlanningSnapshot,
  index: Index,
  config: Required<TablePlanningConfig>,
  warnings: string[],
  addReason: (task: PlanningTask, reason: string) => void
): void {
  const from = requireTask(index, dependency.from);
  const to = requireTask(index, dependency.to);
  const [start, end] = requireDates(to);
  const bound = dependencyBound(dependency, from, to, next, config);
  const endpoint = dependency.type[1] === "F" ? end : start;
  if (endpoint >= bound) {
    return;
  }
  if (config.scheduling === "manual") {
    warnings.push(
      `${to.label}: ${dependency.type} dependency ${dependency.id} is not satisfied.`
    );
    return;
  }
  requireFlag(config.allowDateEdit);
  if (isRollup(config) && index.children.has(planningKey(to.ref))) {
    moveGroupToBound(to, dependency, bound, next, index, config);
  } else {
    const calendar = taskCalendar(to, next);
    const duration = workingDuration(
      start,
      end,
      calendar,
      config.maxCalendarSearchDays
    );
    const targetStart =
      dependency.type[1] === "F"
        ? addWorkingDays(
            bound,
            1 - duration,
            calendar,
            config.maxCalendarSearchDays
          )
        : bound;
    moveTask(to, Math.max(0, targetStart - start), next, index, config);
  }
  addReason(to, `dependency:${dependency.id}`);
  rollupDates(index, config);
}
export function calculatePlanning(
  snapshot: PlanningSnapshot,
  mutations: PlanningMutation[],
  input: TablePlanningConfig
): { snapshot: PlanningSnapshot; preview: Omit<PlanningPreview, "id"> } {
  const config = planningDefaults(input);
  if (!config.enabled) {
    throw new PlanningError("feature-disabled", "Planning is disabled.");
  }
  if (snapshot.scopeId !== config.scopeId) {
    throw new PlanningError(
      "scope-mismatch",
      "This planning snapshot belongs to a different scope."
    );
  }
  if (!snapshot.complete || snapshot.nextCursor) {
    throw new PlanningError(
      "incomplete-graph",
      "Load the complete dependency graph before recalculating."
    );
  }
  if (!snapshot.sources.some((source) => source.id === config.sourceId)) {
    throw new PlanningError(
      "missing-source",
      "The active source is unavailable."
    );
  }
  const baseline = resolvedPlanningSnapshot(snapshot, config);
  syncRecords(baseline);
  const next = structuredClone(baseline);
  let index = indexPlanning(next, config);
  const reasons = new Map<string, Set<string>>();
  const addReason = (task: PlanningTask, reason: string): void => {
    const key = planningKey(task.ref);
    const values = reasons.get(key) ?? new Set<string>();
    values.add(reason);
    reasons.set(key, values);
  };
  for (const mutation of mutations) {
    if (
      mutation.type === "dependency.put" ||
      mutation.type === "dependency.remove"
    ) {
      mutateDependency(mutation, next, index, config);
    } else {
      mutateTask(mutation, next, index, config);
      addReason(requireTask(index, mutation.ref), "requested");
    }
    index = indexPlanning(next, config);
    rollupDates(index, config);
  }
  const warnings: string[] = [];
  const dependencies = [...next.dependencies].sort(
    (a, b) =>
      (index.order.get(`${planningKey(a.to)}:in`) ?? 0) -
      (index.order.get(`${planningKey(b.to)}:in`) ?? 0)
  );
  for (const dependency of dependencies) {
    satisfyDependency(dependency, next, index, config, warnings, addReason);
  }
  syncRecords(next);
  const changes: PlanningChange[] = [];
  const beforeIndex = new Map(
    baseline.tasks.map((task) => [planningKey(task.ref), task])
  );
  for (const task of next.tasks) {
    const before = beforeIndex.get(planningKey(task.ref)) as PlanningTask;
    if (JSON.stringify(task) === JSON.stringify(before)) {
      continue;
    }
    requireEditable(task);
    changes.push({
      ref: task.ref,
      before,
      after: structuredClone(task),
      reasons: [
        ...(reasons.get(planningKey(task.ref)) ?? [
          isRollup(config) && index.children.has(planningKey(task.ref))
            ? "summary"
            : "group-or-calendar",
        ]),
      ],
    });
  }
  return {
    snapshot: next,
    preview: {
      revision: snapshot.revision,
      changes,
      dependencies: next.dependencies,
      warnings,
    },
  };
}

function treeGroups(
  snapshot: PlanningSnapshot,
  included: Set<string>,
  tasks: Map<string, PlanningTask>
): { children: Map<string, PlanningTask[]>; roots: PlanningTask[] } {
  const children = new Map<string, PlanningTask[]>();
  const roots: PlanningTask[] = [];
  for (const task of snapshot.tasks) {
    if (!included.has(planningKey(task.ref))) {
      continue;
    }
    if (
      task.parent &&
      included.has(planningKey(task.parent)) &&
      tasks.has(planningKey(task.parent))
    ) {
      const key = planningKey(task.parent);
      const list = children.get(key) ?? [];
      list.push(task);
      children.set(key, list);
    } else {
      roots.push(task);
    }
  }
  return { children, roots };
}
function includeAncestors(
  tasks: Map<string, PlanningTask>,
  included: Set<string>,
  visible?: Set<string>
): void {
  if (visible) {
    for (const key of visible) {
      let parent = tasks.get(key)?.parent;
      const visited = new Set<string>();
      while (parent) {
        const id = planningKey(parent);
        if (visited.has(id)) {
          break;
        }
        visited.add(id);
        included.add(id);
        parent = tasks.get(id)?.parent;
      }
    }
  }
}
/** Preserve parent context without turning filtered-out siblings into visible matches. */
export function planningTree(
  snapshot: PlanningSnapshot,
  visible?: Set<string>,
  collapsed = new Set<string>()
): { task: PlanningTask; depth: number; hasChildren: boolean }[] {
  const tasks = new Map(
    snapshot.tasks.map((task) => [planningKey(task.ref), task])
  );
  const included = visible ? new Set(visible) : new Set(tasks.keys());
  includeAncestors(tasks, included, visible);
  const { children, roots } = treeGroups(snapshot, included, tasks);
  const rows: { task: PlanningTask; depth: number; hasChildren: boolean }[] =
    [];
  const seen = new Set<string>();
  const stack = roots.reverse().map((task) => ({ task, depth: 0 }));
  while (stack.length) {
    const item = stack.pop();
    if (!item) {
      break;
    }
    const key = planningKey(item.task.ref);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const group = children.get(key) ?? [];
    rows.push({ ...item, hasChildren: group.length > 0 });
    if (!collapsed.has(key)) {
      for (let i = group.length - 1; i >= 0; i -= 1) {
        const child = group[i];
        if (child) {
          stack.push({ task: child, depth: item.depth + 1 });
        }
      }
    }
  }
  return rows;
}

export function normalizeGanttView(
  value: unknown
): import("./types").TableGanttViewConfig {
  if (!value || typeof value !== "object") {
    return {};
  }
  const input = value as Record<string, unknown>;
  const result: import("./types").TableGanttViewConfig = {};
  if (input.zoom === "day" || input.zoom === "week" || input.zoom === "month") {
    result.zoom = input.zoom;
  }
  if (
    Number.isInteger(input.weekStartsOn) &&
    Number(input.weekStartsOn) >= 0 &&
    Number(input.weekStartsOn) <= 6
  ) {
    result.weekStartsOn = Number(input.weekStartsOn);
  }
  if (typeof input.showDependencies === "boolean") {
    result.showDependencies = input.showDependencies;
  }
  if (typeof input.anchorDate === "string") {
    try {
      dateDay(input.anchorDate);
      result.anchorDate = input.anchorDate;
    } catch {
      /* Invalid shared URL dates inherit the application default. */
    }
  }
  return result;
}
