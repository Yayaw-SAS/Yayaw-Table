# Install and upgrade

YaYaw Table is not on npm. The registry at `https://table.yayaw.app/r/`
(GitHub Pages) serves shadcn registry items; the shadcn CLI (React) or
shadcn-vue CLI (Vue) copies their files into the app and adds their npm and
shadcn dependencies. The host root is not an install target: always use a
`/r/<item>.json` URL or the `@yayaw` namespace.

## Items

<!-- skill-check: registry-items -->
| Item | Edition | What it adds | Dependencies it brings |
| --- | --- | --- | --- |
| `yayaw-table` | React | The table and every core mode, forms, record details, import, export, connector screens | TanStack Query and Table 9, nuqs, jotai, sonner, zod, Base UI, react-day-picker, dnd-kit…; shadcn `alert-dialog`, `badge`, `button`, `checkbox`, `collapsible`, `command`, `dialog`, `drawer`, `dropdown-menu`, `empty`, `field`, `input`, `label`, `popover`, `questionnaire`, `radio-group`, `scroll-area`, `select`, `separator`, `skeleton`, `slider`, `switch`, `table`, `tabs`, `textarea`, `tooltip` |
| `yayaw-table-vue` | Vue | The same product for Vue, with its own Reka UI controls and stylesheet | `vue@^3.5`, `@tanstack/vue-query`, `@tanstack/vue-table@9.2.4`, `reka-ui`, `vue-sonner`, `zod`, `lucide-vue-next`, `@internationalized/date`, `date-fns` |
| `yayaw-table-calendar` | React | Calendar mode, `calendarRenderer` | `@fullcalendar/react`, `temporal-polyfill` |
| `yayaw-table-vue-calendar` | Vue | Calendar mode, `calendarRenderer` | `@fullcalendar/vue3`, `temporal-polyfill` |
| `yayaw-table-chart` | React | Chart mode, `chartRenderer` | `recharts`, shadcn `chart` |
| `yayaw-table-vue-chart` | Vue | Chart mode, `chartRenderer` | `@unovis/vue`, `@unovis/ts` |
| `yayaw-table-map` | React | Map mode, `mapRenderer` | `maplibre-gl`, mapcn (`https://mapcn.dev/r/map.json`) |
| `yayaw-table-vue-map` | Vue | Map mode, `mapRenderer` | `maplibre-gl` |
| `yayaw-table-dashboard` | React | `YayawDashboard` | `gridstack`; shadcn `calendar`, `dialog`, `dropdown-menu`, `input`, `native-select`, `popover`, `textarea` |
| `yayaw-table-vue-dashboard` | Vue | `YayawDashboard.vue` | `gridstack` |
| `yayaw-table-connector-notion` | server, React folder | `connector-model.ts`, `sync-engine.ts`, `notion.ts` | none (uses `fetch` and Web Crypto) |
| `yayaw-table-connector-google-sheets` | server, React folder | `connector-model.ts`, `sync-engine.ts`, `google-sheets.ts` | none |
| `yayaw-table-vue-connector-notion` | server, Vue folder | the same files | none |
| `yayaw-table-vue-connector-google-sheets` | server, Vue folder | the same files | none |
| `yayaw-table-base` | React | Optional shadcn CLI v4 base: `base-vega`, lucide, neutral, the `@yayaw` namespace, the font and the table | `tw-animate-css`… |
| `font-yayaw-sans` | React | Optional Plus Jakarta Sans as `--font-sans` | `@fontsource-variable/plus-jakarta-sans` |

Where the files land (registry targets, under your components alias):

- React: `components/ui/yayaw-table/` (core), `components/ui/yayaw-table-calendar/`,
  `components/ui/yayaw-table-chart/`, `components/ui/yayaw-table-map/`,
  `components/ui/yayaw-table-dashboard/`, and the connectors in
  `components/ui/yayaw-table/connectors/`.
- Vue: everything under `components/ui/yayaw-table-vue/`, optional items in
  its `calendar/`, `chart/`, `map/`, `dashboard/` and `connectors/` folders.

An app installs the edition of its framework; the editions do not depend on
each other. Connector items are server code; never import them in client
components.

## Commands

```bash
# Latest React edition and optional items
npx shadcn@latest add https://table.yayaw.app/r/yayaw-table.json
npx shadcn@latest add https://table.yayaw.app/r/yayaw-table-chart.json

# Latest Vue edition and optional items
npx shadcn-vue@latest add https://table.yayaw.app/r/yayaw-table-vue.json
npx shadcn-vue@latest add https://table.yayaw.app/r/yayaw-table-vue-chart.json

# With "registries": { "@yayaw": "https://table.yayaw.app/r/{name}.json" } in components.json
npx shadcn@latest add @yayaw/yayaw-table
```

`pnpm dlx`, `yarn dlx` and `bunx --bun` work the same way.

## Pin a version and verify it

Every release publishes immutable snapshots of all items, React and Vue:
`https://table.yayaw.app/r/vX.Y.Z/<item>.json`, listed by
`https://table.yayaw.app/r/vX.Y.Z/release.json`. The GitHub release `vX.Y.Z`
attaches the same files, and GitHub records a SHA-256 digest for each asset.
Verify before installing, then install the file you verified (both CLIs
accept a local `.json` item):

```bash
VERSION=v3.6.1
curl -fsSL "https://table.yayaw.app/r/$VERSION/yayaw-table.json" -o yayaw-table.json
shasum -a 256 yayaw-table.json   # sha256sum on Linux
gh release view "$VERSION" --repo Yayaw-SAS/Yayaw-Table --json assets \
  --jq '.assets[] | select(.name == "yayaw-table.json") | .digest'   # sha256:…
npx shadcn@latest add ./yayaw-table.json
```

Record the version you installed (the copied files carry none), for example
in the README or next to `components.json`, and keep the digests in review.

From v3.7.0, a pinned optional item depends on the core of the same version
(`https://table.yayaw.app/r/vX.Y.Z/yayaw-table.json` or
`…/vX.Y.Z/yayaw-table-vue.json`), so installing it keeps the core at your
version. Snapshots up to v3.6.1 still point optional items at the **latest**
core URL: with those, refuse the CLI's offers to overwrite files of the core
folder, or review `git diff` afterwards and restore them.

## Host requirements

React:

- shadcn/ui initialized with a **Base UI** style (`base-vega` or another
  `base-*` style). The copied code composes primitives through Base UI's
  `render` prop; Radix-based styles (`asChild`) do not type-check. Starting a
  new app, `yayaw-table-base` sets this up.
- Tailwind CSS with the shadcn tokens, and the `@/components`,
  `@/components/ui` and `@/lib/utils` (`cn`) aliases.
- React 19, an ESM build targeting ES2022 or newer (TanStack Table 9).
- One `QueryClient` for the app (`QueryClientProvider`; a different client
  passed as `queryClient` throws), a nuqs adapter (`NuqsAdapter` from
  `nuqs/adapters/next/app`, `nuqs/adapters/next/pages`, `nuqs/adapters/react`,
  `nuqs/adapters/react-router`…) and one sonner `Toaster`.
- A bundler that accepts CSS imported from components: the table imports its
  own stylesheets (tags, record surfaces, media viewer, file tree). Vite and
  the Next.js App Router do; the Next.js Pages Router does not.
- In 3.6.1 two copied files import shadcn components the item does not declare:
  `combobox` in `components/ui/yayaw-table/components/cells/inline-editable-cell.tsx`
  and `card` in `components/ui/yayaw-table/ui-custom/kanban.tsx`. If the
  type-check cannot resolve them, run `npx shadcn@latest add combobox card`.

Vue:

- Vue 3.5+, an ESM build targeting ES2022 or newer. Tailwind is not needed:
  the stylesheet reads the shadcn CSS variables (`--background`, `--muted`,
  `--border`, `--input`, `--primary`, `--radius`, `--chart-1`…) and falls back
  to shadcn's neutral theme.
- One `vue-sonner` `Toaster` at the app root (the table sends every
  notification there).
- Importing from `@/components/ui/yayaw-table-vue` loads the stylesheet. A page
  that imports a single component file (for example a public form page) must
  import `components/ui/yayaw-table-vue/styles.css` itself.
- `YayawTablePlugin` optionally registers `YayawDataTable` and `DataTable`
  globally.

## Editions and parity

React and Vue are one product. Parity is the project's release gate: a
consumer-facing change ships in both editions with equivalent tests, and the
known differences are written down in the
[parity document](https://github.com/Yayaw-SAS/Yayaw-Table/blob/main/docs/FRAMEWORK-PARITY.md).
For a host this means one backend serves both editions, saved views and links
created in one open in the other, and a configuration object can be shared.
Framework-native parts differ: components and props syntax, slots versus
render props, icons (React nodes, Vue components), renderer objects
(`View`/`Settings` versus `view`/`settings`) and some translation key names;
see [configuration](configuration.md#react-and-vue-differences).

## Upgrade

1. Read the [changelog](https://github.com/Yayaw-SAS/Yayaw-Table/blob/main/CHANGELOG.md)
   between your version and the target; minor releases can add union members
   (display modes, column types, filter operators) that exhaustive
   `Record<TableDisplayMode, …>` or `switch` statements in your code must add.
2. Reinstall every item you use at the new version (core first), with the
   same care about optional items described above.
3. Review `git diff` of the copied folders; re-apply your recorded patches.
4. Type-check, run the host tests, and open each display mode.
5. Update this skill from the matching release tag.
