# YaYaw Table testing guide

## Complete local verification

```bash
bun install
bun install --cwd packages/yayaw-table-vue
bun run check
bun run type-check
bun run test
bun run vue:test
bun run vue:build
bun run registry:pages
```

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
- Type checking passes.
- `registry/default`, `registry/registry.json`, and `public/r` match the source.
- `dist/registry-pages` contains only static registry delivery files.
- Changesets are added only for consumer-facing changes.
