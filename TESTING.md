# YaYaw Table testing guide

## Complete local verification

```bash
bun install
bun install --cwd packages/yayaw-table-vue
bun run check
bun run type-check
bun run test
bun run vue:test
bunx playwright install chromium   # once
bun run e2e
bun run vue:build
bun run registry:pages
```

`bun run e2e` runs the Playwright suites in `e2e/` against the React and Vue
demos, which it starts on ports 5186 and 5187. Set `E2E_REACT_PORT` and
`E2E_VUE_PORT` when those ports are taken, and `CI=1` to start fresh servers
instead of reusing running ones. `bun run release:check` runs the same checks
in one command, after validating changesets; install Chromium first.

The final command rebuilds both registry editions and prepares the exact static artifact deployed by GitHub Pages under `dist/registry-pages/r`.

## Registry smoke tests

Serve `dist/registry-pages` with any static HTTP server, then verify:

```bash
npx shadcn@latest view http://127.0.0.1:8080/r/yayaw-table.json
npx shadcn-vue@latest view http://127.0.0.1:8080/r/yayaw-table-vue.json
```

The static host intentionally has no application frontend. Documentation and the interactive demo are tested in the Yayaw repository.

## Pre-PR checklist

- React and Vue tests pass.
- The end-to-end suites pass in both editions.
- Type checking passes.
- `registry/default`, `registry/registry.json`, and `public/r` match the source.
- `dist/registry-pages` contains only static registry delivery files.
- Changesets are added only for consumer-facing changes.
