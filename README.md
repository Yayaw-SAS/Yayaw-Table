# YaYaw Table

Flexible, type-safe data tables for React and Vue 3, distributed as Shadcn-compatible registries.

[Live demo](https://yayaw.app/table/example) · [Documentation](https://yayaw.app/docs/table) · [Documentation française](https://yayaw.app/fr/docs/table)

Built on TanStack Table with table, Kanban, gallery, file tree, form and feed views. Optional registry items add calendars, charts, maps, dashboards, Excel export and server connectors. React and Vue share the same public contracts and behavior; see [framework compatibility](docs/FRAMEWORK-PARITY.md).

## Editions

- React: source of truth in `src/components/ui/yayaw-table`
- Vue 3: standalone package in `packages/yayaw-table-vue`
- Generated React registry: `registry/default/ui/yayaw-table`
- Published artifacts: `public/r`

## Install

React:

```bash
npx shadcn@latest add https://table.yayaw.app/r/yayaw-table.json
```

Vue 3:

```bash
npx shadcn-vue@latest add https://table.yayaw.app/r/yayaw-table-vue.json
```

Optional views and integrations ship as separate registry items. See the [documentation](https://yayaw.app/docs/table) for setup and configuration.

Registry artifacts are served by GitHub Pages at `https://table.yayaw.app/r/`. Use an explicit registry JSON URL or the `@yayaw` namespace when installing.

Both editions use TanStack Table 9.2.4 and require an ESM build targeting
ES2022 or newer. The Vue edition continues to require Vue `^3.5.0`; this
migration does not widen framework compatibility.

Pinned React releases are available under `/r/vX.Y.Z/yayaw-table.json`. Projects with the registry namespace configured can also use:

```bash
npx shadcn@latest add @yayaw/yayaw-table
```

## Use with AI agents

[`skills/yayaw-table`](skills/yayaw-table/SKILL.md) is an
[Agent Skill](https://agentskills.io) for coding agents such as Claude Code
and Codex. It tells them how to install, configure and extend YaYaw Table in
an app (registry items and pinned installs, `TableConfig`, display modes,
server contracts, forms, connectors, React/Vue parity and known pitfalls) and
sends them to the copied source and types, which remain the source of truth.

Copy the folder into your project, ideally from the release you installed
(add `--branch vX.Y.Z` to the clone):

```bash
git clone --depth 1 https://github.com/Yayaw-SAS/Yayaw-Table.git /tmp/yayaw-table-repo
# Claude Code: this project, or ~/.claude/skills/ for every project
mkdir -p .claude/skills && cp -R /tmp/yayaw-table-repo/skills/yayaw-table .claude/skills/
# Codex
mkdir -p .codex/skills && cp -R /tmp/yayaw-table-repo/skills/yayaw-table .codex/skills/
```

Agents load it when a task matches its description. In this repository,
`bun run skill:check` (part of `bun run check`) fails when the skill no longer
matches the code: display modes, actions, scope kinds, column types, filter
operators, registry items, helper names, paths and links.

## React quick start

```tsx
import { DataTable } from "@/components/ui/yayaw-table";
import { getTableActions, getTableConfig } from "./table-config";

export function ProductsTable() {
  return (
    <DataTable
      getTableActions={getTableActions}
      getTableConfig={getTableConfig}
      tableType="products"
      title="Products"
    />
  );
}
```

## Integration guides

- [React and Vue compatibility, including server rendering](docs/FRAMEWORK-PARITY.md)
- [Vue edition and quick start](packages/yayaw-table-vue/README.md)
- [Saved views](docs/SAVED-VIEWS.md)
- [Dashboard screens](docs/DASHBOARD-SCREENS.md)
- [File tree](docs/FILETREE.md)
- [Record details and audit contract](docs/RECORD-DETAILS.md)
- [Server connectors](docs/connectors.md)
- [Server action contracts](skills/yayaw-table/references/server-contracts.md)
- [Gantt guide and examples](https://yayaw.app/docs/table/gantt)

## Development

```bash
bun install
bun install --cwd packages/yayaw-table-vue
bun run type-check
bun run test
bun run vue:test
bun run vue:build
bun run registry:pages
```

After editing React source files, run `bun run registry:sync`. To rebuild every public registry artifact and the GitHub Pages bundle, run `bun run registry:pages`.

Release notes and SemVer bumps use Changesets. See [the release workflow](./docs/RELEASES.md).

## License

MIT
