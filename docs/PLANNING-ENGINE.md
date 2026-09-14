# Planning engine

The framework-neutral engine is maintained in `src/components/ui/yayaw-table/planning`.
`bun run contracts:sync` copies its TypeScript and CSS into the independently installable Vue registry.
React and Vue run the same contract fixtures. No third-party Gantt package or server is required.

## Identity and normalized data

A `PlanningRef` is `{ source, id }`. Source identifies application data, not a mounted table instance.
A `PlanningSnapshot` contains one `scopeId`, an opaque `revision`, source definitions, calendars,
tasks, dependencies, and a `complete` marker. Include every required ancestor and dependency endpoint,
even when hidden by table filters or pagination. A missing source, parent, calendar or dependency
endpoint prevents scheduling. An unscheduled record uses `start: null, end: null` and remains visible.
Both dates are required when a dependency needs that record.

`PlanningTask.parent` represents hierarchy. `PlanningDependency` represents a directed scheduling
constraint. Do not infer one relationship from the other. Cross-source parents are supported by
normalized refs. A scalar `source.fields.parent` column can represent only same-source parents;
applications with cross-source hierarchy persist `task.parent` separately.

`planningTasksFromRows` normalizes flat records or `subRows`, accepts custom identity/parent/children
adapters, and reads date/title mappings from `source.fields` or the supplied `gantt` configuration.
It returns both the normalized tasks and their source field mappings. Use the returned source in the
snapshot so inline edits and the host planner interpret record patches consistently. Supply `toDate`
when converting timestamps: the application owns the time zone. The default accepts civil date strings.

## Calendar and boundary conventions

Dates are validated `YYYY-MM-DD` civil dates. End dates are inclusive. UTC integer-day arithmetic
avoids daylight-saving drift; UTC here is an arithmetic representation, not the application's time zone.
A one-day task has identical start and end dates. Task calendars override source calendars, which
override `defaultCalendarId`. Weekdays use Sunday = 0. Date exceptions open or close individual days.
`weekStartsOn` changes display alignment only.

Constraints use exclusive finish boundaries internally:

| Type | Constraint before offset |
| --- | --- |
| FS | Successor start is after the predecessor's occupied end date |
| SS | Successor start is at or after predecessor start |
| FF | Successor occupied end is at or after predecessor occupied end |
| SF | Successor exclusive finish is at or after predecessor start |

Offsets are signed integers. `lagUnit: "workingDays"` counts the successor's working calendar;
`"calendarDays"` counts civil days. Closed boundary dates advance to the next working date.
For example, FS with Friday finish and zero offset starts Monday in a Monday–Friday calendar;
FS with offset 1 starts Tuesday. Existing successor margins are preserved: automatic adjustment
moves only tasks whose constraints require a later boundary.

## Hierarchy and validation

`parentDates: "rollup"` derives summaries from descendant bounds. An unknown child interval makes
the summary unscheduled. `"independent"` retains each parent's own interval. Summary movement shifts
descendants and preserves each leaf's number of working days; different calendars may change elapsed
spans and relative gaps. Summary resizing is rejected. Edit children to change a summary's duration.

The graph uses separate entry/exit vertices for each task. Hierarchy links connect group entry to child
entry, and child exit to group exit. Dependency links connect predecessor exit to successor entry.
A topological traversal rejects self-links, dependency cycles, summary/descendant links and indirect
cycles across groups or sources. Constraints targeting groups are rechecked after calendar adjustment.
This avoids expanding each group dependency into every pair of leaves.

The horizon defaults to 36,600 days and bounds working-day searches and moves. Inputs exceeding the
horizon or calendars without a reachable working date fail with a structured `PlanningError`.
No source snapshot is mutated during calculation.

## Pure API

`calculatePlanning(snapshot, mutations, config)` returns a new snapshot plus preview changes,
reasons, dependencies and warnings. `resolvedPlanningSnapshot` derives summary dates for display.
Changes include affected parents, descendants and successors, including records outside the current view.

Supported mutations are `dates`, `move`, `parent`, `record`, `dependency.put` and `dependency.remove`.
`record` applies a mixed record patch and routes mapped planning fields through the same validation.
Flags are operation gates, not authorization grants. Every changed task must remain editable.
The host must additionally authorize the requested operations and the complete affected record set.
