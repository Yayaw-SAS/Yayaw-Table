/** Civil dates are YYYY-MM-DD strings, never browser-local timestamps. End dates are inclusive. */
export type PlanningDate = string;
export type DependencyType = "FS" | "SS" | "FF" | "SF";
export interface PlanningRef {
  source: string;
  id: string;
}
export interface PlanningCalendar {
  id: string;
  /** Sunday is 0; this is unrelated to the first displayed weekday. */
  workingDays: number[];
  /** true opens a date, false closes it. */
  exceptions?: Record<PlanningDate, boolean>;
}
export interface PlanningFields {
  title?: string;
  start: string;
  end: string;
  parent?: string;
  calendar?: string;
}
export interface PlanningSource {
  id: string;
  label: string;
  calendarId?: string;
  fields?: PlanningFields;
}
export interface PlanningTask {
  ref: PlanningRef;
  label: string;
  start: PlanningDate | null;
  end: PlanningDate | null;
  parent?: PlanningRef | null;
  calendarId?: string;
  /** Host authorization applies to every affected task, including hidden successors. */
  editable?: boolean;
  record?: Record<string, unknown>;
}
export interface PlanningDependency {
  id: string;
  from: PlanningRef;
  to: PlanningRef;
  type: DependencyType;
  lag?: number;
  lagUnit?: "workingDays" | "calendarDays";
}
export interface PlanningSnapshot {
  scopeId: string;
  revision: string;
  tasks: PlanningTask[];
  dependencies: PlanningDependency[];
  sources: PlanningSource[];
  calendars: PlanningCalendar[];
  defaultCalendarId: string;
  /** A partial graph is displayable but must never be scheduled. */
  complete: boolean;
  nextCursor?: string;
}
export interface TablePlanningConfig {
  enabled: boolean;
  scopeId: string;
  sourceId: string;
  allowDateEdit?: boolean;
  allowDependencyEdit?: boolean;
  allowHierarchyEdit?: boolean;
  allowCrossTableDependencies?: boolean;
  allowSummaryMove?: boolean;
  hierarchy?: boolean;
  parentDates?: "rollup" | "independent";
  dependencyTypes?: DependencyType[];
  scheduling?: "manual" | "preview" | "automatic";
  /** Bound malformed calendars and unsatisfiable schedules without hanging the UI. */
  maxCalendarSearchDays?: number;
}
export interface TableGanttViewConfig {
  zoom?: "day" | "week" | "month";
  weekStartsOn?: number;
  showDependencies?: boolean;
  anchorDate?: PlanningDate;
}
export interface TableGanttConfig extends TableGanttViewConfig {
  titleColumn?: string;
  startColumn?: string;
  endColumn?: string;
  height?: number;
}
export type PlanningMutation =
  | {
      type: "dates";
      ref: PlanningRef;
      start: PlanningDate | null;
      end: PlanningDate | null;
    }
  | { type: "move"; ref: PlanningRef; days: number }
  | { type: "parent"; ref: PlanningRef; parent: PlanningRef | null }
  | { type: "record"; ref: PlanningRef; patch: Record<string, unknown> }
  | { type: "dependency.put"; dependency: PlanningDependency }
  | { type: "dependency.remove"; id: string };
export interface PlanningChange {
  ref: PlanningRef;
  before: PlanningTask;
  after: PlanningTask;
  reasons: string[];
}
export interface PlanningPreview {
  id: string;
  revision: string;
  changes: PlanningChange[];
  dependencies: PlanningDependency[];
  warnings: string[];
}
export interface PlanningResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
export interface PlanningContext {
  scopeId: string;
  sourceId: string;
}
export interface PlanningLoadInput extends PlanningContext {
  cursor?: string;
  signal?: AbortSignal;
}
export interface PlanningPreviewInput extends PlanningContext {
  revision: string;
  mutations: PlanningMutation[];
}
export interface PlanningApplyInput extends PlanningContext {
  previewId: string;
  revision: string;
  /** Reuse this key after an uncertain response. */
  idempotencyKey: string;
}
export interface TablePlanningActions {
  load: (input: PlanningLoadInput) => Promise<PlanningSnapshot>;
  preview: (
    input: PlanningPreviewInput
  ) => Promise<PlanningResult<PlanningPreview>>;
  apply: (
    input: PlanningApplyInput
  ) => Promise<PlanningResult<PlanningSnapshot>>;
}
export class PlanningError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "PlanningError";
  }
}
export const planningKey = (ref: PlanningRef): string =>
  JSON.stringify([ref.source, ref.id]);
export const samePlanningRef = (
  a?: PlanningRef | null,
  b?: PlanningRef | null
): boolean =>
  a == null ? b == null : b != null && a.source === b.source && a.id === b.id;
