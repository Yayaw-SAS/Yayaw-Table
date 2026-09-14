# Planning adapters and atomic persistence

See [the engine contract](PLANNING-ENGINE.md) and [Gantt configuration](GANTT.md).
An application supplies `actions.planning: { load, preview, apply }`. Ordinary table list filters
and pagination are never passed to these actions. The application owns data storage, access control,
calendar definitions, deletion behavior and any additional business validation.

## Load

`load({scopeId, sourceId, cursor?, signal?})` returns a `PlanningSnapshot` page. Return all source and
calendar metadata on the first page. Pages must use the same revision and contain no duplicate task
or dependency identities. Return `nextCursor` until the final page, then `complete: true`.
The client progressively displays loaded tasks but waits for a complete, valid graph before editing.
Abort obsolete loads and retry when a revision changes between pages. Missing or inaccessible records
must not be silently removed from the graph and treated as a successful complete load.

## Preview

`preview({scopeId, sourceId, revision, mutations})` validates scope, current permissions and revision,
calculates all effects, applies application validation, and returns:

```ts
{ success: true, data: { id, revision, changes, dependencies, warnings } }
```

Each change contains `ref`, `before`, `after`, and `reasons`. `dependencies` is the complete proposed
edge set. Retain the validated proposal or the mutations behind an opaque preview ID. The client must
never be able to substitute arbitrary changes during `apply`. Preview must perform no business writes.

The native preview shows old/new dates, hierarchy and changed record fields, plus added, updated and
removed dependencies. It includes hidden affected sources. Cancellation performs no apply call.
A client flag or row permission can further restrict an application-approved proposal.

## Apply

`apply({scopeId, sourceId, previewId, revision, idempotencyKey})` must:

1. Verify the preview belongs to the same application/user/source context.
2. Resolve a matching completed idempotency request before creating another commit.
3. Recheck revision, permissions, calendars, records and application validation.
4. Commit all task/record and relationship changes, the new revision, and the idempotency result
   in one transaction.
5. Return `{success: true, data: completeUpdatedSnapshot}` only after the entire transaction commits.

Return `code: "stale-preview"` when any relevant data or permission changed. The client reloads and
requires a new preview. Other failures keep the preview available for retry. A network error after a
possible commit reuses the same idempotency key. Never represent a partial write as success.
A production adapter should persist idempotency records durably and bind previews to the authenticated
principal. Config supplied by a browser must not override server-side feature gates or permissions.

`createMemoryPlanningAdapter({snapshot, config, validate?})` is an executable demonstration of the
complete contract. It retains proposals, revalidates at commit, compares revisions after asynchronous
validation, and atomically replaces its in-memory snapshot. `replaceSnapshot` simulates external
transactions and always creates a fresh revision. The demo stores only in process memory and is not
a durable production database adapter. A page reload resets its records and saved views.

## Shared editing and refresh

Each mounted table owns a planning session. Wrapped `update` and `bulkUpdate` actions route inline
cells, catalogue forms, Kanban field edits and record edits through planning. Mixed patches are saved
atomically with their induced schedule changes; the host adapter persists ordinary fields too.
Supply `source.fields` whenever records can be edited from these surfaces.

After a successful apply, every mounted session with the same `scopeId` receives an invalidation.
React and Vue invalidate their list/aggregate query caches and reload complete planning data. Drafts
and records are not broadcast. An already open preview remains reviewable and its revision is checked
at apply. Cross-window/server notifications remain application-owned; update revisions and invalidate
queries or reload planning when receiving them. Scope IDs must identify an actual application planning
boundary, including tenant/project isolation where applicable.

Create, delete and custom application mutations remain application-owned. They must maintain graph
integrity, update its revision and invalidate the corresponding data. Deleting a dependency endpoint
without resolving its links leaves an invalid graph that cannot be scheduled.
