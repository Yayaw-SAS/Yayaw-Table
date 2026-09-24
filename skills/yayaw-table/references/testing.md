# Testing and parity

## In a host application

Test your side of the contract; the copied components have their own suites.

- `list`: pages from 1 with `totalCount` or `pageCount`, every sort, search,
  each filter operator your column types can produce (see
  [server contracts](server-contracts.md#filter-operators)), an OR view
  (`advancedFilterJoin: "or"`), dashboard `requiredFilters` ANDed with an OR
  view, every scope you answer (and `meta.scope: "applied"`), and rows of
  another tenant never returned.
- Mutations: permission refusals, stale versions detected through
  `context.row`, `fieldErrors`, partial bulk failures with `failedIds`.
- `aggregate`: bucket keys in the column's time zone, multi-select values
  counted in each group, `requiredFilters` applied.
- Saved views: another user's personal view never listed; sharing and
  deleting refused without the right; favorites per user.
- Public forms: a tampered snapshot argument to `formLinks.publish` has no
  effect; `acceptPublicFormResponse()` drops unknown and hidden answers.
- Connectors: plans built with in-memory adapters; a second run of the same
  sync plans nothing (`summarizeSyncPlan()` reports no changes).
- Component tests: React needs a `QueryClientProvider` and a nuqs adapter
  (`NuqsTestingAdapter` from `nuqs/adapters/testing`); Vue mounts with
  `config` and actions or `data`.
- A browser pass per display mode you offer, with realistic data: thousands
  of rows, empty values, long text, other time zones, phone width.

## Contributing to YaYaw Table

The parity rules of the repository (`AGENTS.md`) are a release gate:

- Change both editions in the same pull request, with equivalent tests and no
  known functional gap; document unavoidable framework differences.
- Shared, framework-neutral code lives in React
  `src/components/ui/yayaw-table/utils/` (and `planning/`, `connectors/`);
  `bun run contracts:sync` copies it into `packages/yayaw-table-vue/src/`.
  Edit the React copy only. `registry/default/` and `public/r/` are generated:
  run `bun run registry:sync` after editing React sources, and never edit a
  versioned `public/r/vX.Y.Z/` snapshot.
- Shared suites: `tests/<feature>-suite.ts` exports the cases, run by
  `tests/<feature>.test.ts` (Bun, React) and by
  `packages/yayaw-table-vue/src/<feature>.test.ts` (Vitest); data-driven
  contracts use `tests/fixtures/*.json`.
- Browser: `e2e/*.spec.ts` (Playwright) runs every spec once per edition,
  against the React preview (`examples/record-presentation-preview/`) and the
  Vue demo (`packages/yayaw-table-vue/demo/`), both on `?example=…` routes
  rendering the same `examples/*.ts` data. `E2E_REACT_PORT` and
  `E2E_VUE_PORT` move the ports for side-by-side checkouts. Keep the Vue demo
  representative of the React example.
- Update `docs/FRAMEWORK-PARITY.md` with every parity-affecting change, add a
  changeset (`bun run changeset`, package `yayaw-table-workspace`) for
  consumer-facing changes, and open the companion English and French
  documentation change in the Yayaw repository for public API or behaviour
  changes.
- Keep this skill true: `bun run skill:check` (also in `bun run check`)
  compares its checked tables, action names, scope kinds, helper names, paths,
  imports and links with the code.

Commands:

```bash
bun install && bun install --cwd packages/yayaw-table-vue
bun run check        # lint and the skill check
bun run type-check
bun run test         # React and shared suites
bun run vue:test     # Vue and shared suites
bun run e2e          # Playwright on both demos
bun run vue:build
bun run registry:sync
bun run release:check   # the full gate before a release
```
