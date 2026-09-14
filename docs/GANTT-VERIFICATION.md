# Gantt verification

Verified on 2026-09-14 against the four-part implementation based on main `6d9fe3a`.

## Automated checks

- `bun run release:check`: passed (513 React/shared tests, 400 Vue tests, TypeScript,
  Vue library build, independently generated React/Vue registries and static demo).
- Both distributions run the same 45 planning cases, including all four dependency
  types, signed offsets, calendar exceptions, summary/group cycles, colliding IDs,
  incomplete graph pages, stale revisions, atomic failures, permissions, cancellation,
  idempotent retries, automatic/manual modes, UI flags and cross-instance refresh.
- `bun run gantt:build`: passed for the standalone React example.
- Existing non-blocking image lint suppressions, test harness warnings and demo chunk
  size notices remain visible in the standard command output.

## Browser checks

The native in-app browser exercised the standalone React example and Vue's
`?example=gantt` example with the same fixture:

| Interaction | React | Vue |
| --- | --- | --- |
| Initial summary bars, unscheduled row and cross-source release | Passed | Passed |
| Keyboard movement and complete impact preview | Passed | Passed |
| Pointer movement and end resizing | Passed | Passed |
| Cancel without changing stored dates | Passed | Passed |
| Apply changes and refresh Table/common record details | Passed | Passed |
| Open planning from common record details | Passed | Passed |
| Save and restore month zoom and Sunday week origin | Passed | Passed |
| Predecessor source selection after an initially empty source | Passed | Passed |

React's common catalogue form was also exercised with native date-keyboard editing:
Save opened the planning preview, and applying updated the complete successor chain.
Search hid successor rows while the preview still included their changes. Synthetic
browser filling of React's native date control was insufficient to exercise its change
handler; native ArrowUp editing verified that path.

## Public documentation checks

The companion Yayaw change provides English/French snapshots, exact protected source
hash transitions and a pinned first publication. Documentation generation, links,
translations, LLM synchronization, lint, TypeScript and all 27 documentation tests pass.

The full Yayaw test command has existing shared-mock/environment failures: the unchanged
main baseline reports 305 failures and 8 errors; this branch reports the same failure
families plus the new seed test affected by the existing documentation compiler mock.
The documentation suite passes independently. The full app build compiles but cannot
collect server page data without `DATABASE_URL`. No production database was configured
or changed. Documentation publication and deployment readiness remain to be verified
after its PR is merged in the configured deployment environment.
