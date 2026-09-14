# Configurable Gantt views

Gantt planning is optional in both React and Vue. Existing tables keep their behavior unless planning
is explicitly enabled. The native renderer provides a collapsible tree, calendar shading, task and
summary bars, dependency paths, date editing, and a keyboard-accessible relationship editor.

```ts
const gantt = {
  titleColumn: "name",
  startColumn: "start",
  endColumn: "end",
  zoom: "week" as const,
  weekStartsOn: 1,
  showDependencies: true,
};
const planning = {
  enabled: true,
  scopeId: "organization/project",
  sourceId: "tasks",
  scheduling: "preview" as const,
};
const config = defineTableConfig({
  id: "project-tasks",
  columns: { definitions: [
    { id: "name", header: "Name", type: "text" },
    { id: "start", header: "Start", type: "date" },
    { id: "end", header: "End", type: "date" },
  ] },
  table: {
    displayModes: ["table", "gantt", "kanban", "gallery"],
    defaultDisplayMode: "gantt",
    allowEdit: true,
    planning,
    gantt,
  },
});
```

Use the same `gantt` mappings in `planningTasksFromRows` when building the adapter snapshot.
The returned `source.fields` makes form/inline record patches use those same columns. Applications can
instead normalize tasks directly, retaining their own database schema and custom relationship storage.

## Per-table defaults

| Setting | Default |
| --- | --- |
| `planning.enabled` | Explicitly required |
| `planning.scheduling` | `preview` |
| `planning.parentDates` | `rollup` |
| `planning.hierarchy` | `true` |
| `planning.allowDateEdit` | `true` |
| `planning.allowDependencyEdit` | `true` |
| `planning.allowHierarchyEdit` | `true` |
| `planning.allowCrossTableDependencies` | `true` |
| `planning.allowSummaryMove` | `true` |
| `planning.dependencyTypes` | `FS`, `SS`, `FF`, `SF` |
| `planning.maxCalendarSearchDays` | `36600` |
| `gantt.zoom` | `week` |
| `gantt.weekStartsOn` | `1` (Monday) |
| `gantt.showDependencies` | `true` |
| `gantt.height` | `480` CSS pixels |

`manual` reports dependency violations without shifting successors. `automatic` uses the same preview
and atomic apply contract, then applies without a confirmation click. `preview` waits for confirmation.
The independent date/link/hierarchy flags only restrict edits: they cannot override `allowEdit`,
`canEditRow`, task-level authorization, or a refusal by the application's adapter.

Presentation settings `zoom`, `weekStartsOn`, `showDependencies` and `anchorDate` belong to saved views
and table-scoped URLs. Field mappings and height stay in application configuration. Planning rules,
calendars, task dates and relationships never enter the saved-view snapshot.

## Interactions

- Choose Gantt in the existing view menu. Saved views can switch between Table, Gantt, Kanban and Gallery.
- Expand/collapse parents in the Gantt or Table tree. Filters retain ancestor context while hiding
  nonmatching siblings. Sorting orders siblings without breaking the hierarchy.
- Click a task or the planning action in a Table row to edit dates, hierarchy and relationships.
  The common record detail header exposes the same Planning action from Table, Kanban and Gallery.
- Drag a bar to move it. Drag either handle to resize a leaf. Focus the bar/handle and press Left/Right
  for a one-day edit, or Shift+Left/Right for seven days. Calendar validation applies equally to both.
- Select the predecessor's source, record, link type, signed offset and offset unit in the dependency
  editor. All controls are native labelled form controls. Validation errors retain the entered draft.
- Review the complete impact, then apply all changes or cancel. Application failures remain visible.

The renderer virtualizes rows and horizontal day columns. A navigable 180-day window bounds the
rendered timeline; previous/next/today and zoom controls navigate longer schedules. Dependency paths
are drawn when both endpoints are in the rendered window. The relationship editor retains all loaded
links, including hidden endpoints. The planner always works from the full loaded graph.

## Examples and verification

Run `bun run gantt:dev` for the standalone React example at port 5174 and `bun run vue:dev` for the
Vue example at `http://localhost:5173/?example=gantt`. Both use the same tasks, holiday calendar,
unscheduled record, and cross-source release dependency. The `tasks/launch` and `releases/launch`
records deliberately share their record ID. The examples expose in-memory saved views and a catalogue
form as well as the Gantt editor.

See [planning engine](PLANNING-ENGINE.md), [adapter contract](PLANNING-ADAPTERS.md), and
[framework parity](FRAMEWORK-PARITY.md). Shared engine/session/surface regression suites run in Bun
and Vitest against the independently distributed framework files. `bun run release:check` is the
full distribution gate; `bun run gantt:build` additionally verifies the standalone React demo bundle.
