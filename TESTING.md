# YaYaw Table - Testing Guide

## Goals

Validate that source changes under `src/components/ui/yayaw-table` are correctly synced to the Shadcn registry output and that the docs app still builds.

## 1. Static checks

```bash
bun x ultracite check
bun run type-check
```

## 2. Registry sync check

After editing source files, regenerate the registry files:

```bash
bun run registry:sync
```

Then verify expected generated changes in:

- `registry/default/ui/yayaw-table`
- `registry/registry.json`

## 3. Registry build check

Generate distributable JSON files served by the docs app:

```bash
bun run registry:build
```

This updates:

- `public/r/registry.json`
- `public/r/yayaw-table.json`

## 4. Local smoke test

Run the docs app and verify installation snippets and examples:

```bash
bun run dev
```

Recommended checks:

- `/docs/installation` shows Shadcn-only install flow
- `/docs/setup` examples import from `@/components/ui/yayaw-table`
- `/example` renders and table interactions still work

## 5. Pre-PR checklist

- `bun x ultracite check` passes
- `bun run type-check` passes
- registry files are synced if source files changed
- docs do not mention npm package publishing/install paths
