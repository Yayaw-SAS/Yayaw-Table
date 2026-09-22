# Changelog

## 3.2.0

### Minor Changes

- 692de11: Add read-oriented server Kanban lanes with global counts, independent cursor pagination, cancellation and retries in React and Vue. Add controlled custom native filter renderers for application-specific date and relation controls.

## 3.1.1

### Patch Changes

- 60e6b9f: Stop wrapping colour tokens in `hsl()`. The design tokens are oklch, so
  `hsl(var(--primary))` resolves to `hsl(oklch(…))`, which is invalid and dropped
  by the browser: the Kanban active-card bar, the sticky actions and footer cell
  borders, the table's selected-row bar and the filter shimmer, focus-ring and
  value-highlight animations all rendered with no colour at all. Reference the
  tokens directly and express alpha with `color-mix(in oklab, …)`.
- 60e6b9f: Read planning config from a flat catalogue entry. `getTableConfig` may return the behaviour nested
  under `table` or flat at the top level, and `resolveTableCatalogueConfig` has always accepted both,
  but the provider's planning derivation only read the nested shape and fell back to the default table
  config for the flat one. A flat entry therefore lost its `planning` and `gantt` mapping, built no
  planning session, and had the Gantt withheld from its view menu even though it was configured and
  listed in `displayModes`.

## 3.1.0

### Minor Changes

- 3c65c90: Add opt-in automatic page sizing with `table.enableAutoPageSize` in React and Vue. The table's page-size selector can fit rows to the available viewport, react to density and window-size changes, and return to numeric sizes. Pagination remains reachable for a single page when enabled. Gallery and Kanban keep numeric pagination; URLs and saved views continue to store the effective numeric size.
- 3ea9289: Add optional native Gantt planning to React and Vue, with shared civil-date scheduling, configurable hierarchy and calendar rules, cross-source dependencies, and atomic revision-checked preview/apply actions. Include accessible dependency editing, planning-aware table and record edits, saved Gantt views, and executable memory adapters.
- 7450b32: Unify React and Vue record surfaces with a shared responsive presentation option, drawer defaults on desktop and mobile, and uninterrupted view-to-edit transitions.
- fc26386: Add `table.defaultAutoPageSize` to start table views in automatic viewport pagination in React and Vue while preserving manual numeric choices within the active view.
- 457b8ec: Use Shadcn Empty states and offer filter recovery in React and Vue.

  Filtered empty results include a Clear filters action that preserves presentation and the selected view. Custom copy and visibility apply consistently in table, Kanban, and Gallery; loading and failed requests no longer show empty card states. React consumers updating copied files manually must add the Shadcn `empty` component; Vue includes the Empty parts and standalone styles in its registry.

- bacb67f: Add a personal favorite view in React and Vue, restored on arrival with local persistence or optional server preference actions, and document organization sharing responsibilities.
- b24c4bf: Render the Gantt timeline with a native component in each edition, so it reaches its table the way
  Kanban and Gallery do: the table's own selection and title cells in the left column, row click through
  to the record details, the loading overlay and the bulk-actions anchor. React gains
  `components/gantt-view.tsx` and Vue `components/planning/GanttView.vue`, both computing rows,
  virtualization geometry, bar placement, dependency paths, header cells and every date edit from a new
  shared `planning/timeline` model. The shared DOM renderer keeps only the planning dialog, which needs
  no table state. A task from another source, or one outside the table's current page, still renders
  without cells rather than disappearing.
- 7bdfd54: Let a Gantt work from the table's own data like Kanban and Gallery. `createRowsPlanningAdapter`
  derives the planning graph from the existing `list` action and saves date and hierarchy edits through
  the existing `update` action, and React and Vue wire it automatically when `gantt.startColumn` and
  `gantt.endColumn` are mapped and no `actions.planning` adapter is supplied. Add `gantt.parentColumn`
  and `gantt.calendarColumn`, share one preview/apply transaction core between adapters, route every
  timeline, dialog and settings label through `views.gantt.*` with the built-in vocabulary as fallback,
  replace the planning row controls with design-system buttons and translated names, and withhold the
  Gantt display mode when no planning graph can be built.
- ebd8d9e: Add an icon-only density selector beside toolbar filters with S, M, L and XL, and make S more compact in React and Vue.
- adf1d7e: Add equivalent React and Vue gallery media viewers with image/video/audio/PDF previews, separate record information actions, muted hover video, native playback, navigation, and accessible focus restoration. Add S/M/L preview height independently of card width, neutral or colored tags, and content-sized action menus.

  Support modified gallery selection and scoped Ctrl/Cmd+A across matching pages. Connect Ctrl/Cmd+Z to existing record activity and onRevertActivity, including deleted records supplied through details.history and grouped compensating events through transactionId. Applications retain responsibility for persistence, permissions and reversible deletion. Add video record fields and custom rowActions in both editions.

  Vue now defaults to the same wide gallery ratio and colored tags as React. Set aspectRatio: "square" and coloredTags: false explicitly to preserve its previous appearance. Runtime media callbacks stay out of saved views; previewSize is persisted.

  Show a localized success notification after complete activity undo, with full-sentence `details.labels.undoSuccess` overrides shared by shortcuts and record activity. Exclude runtime gallery callbacks from both frameworks’ saved views.

  Connect Ctrl/Cmd+D to the existing permitted row duplication action, including selection of returned copies, partial failure handling, and localized singular/plural feedback.

- ebd15ce: Pass original row context to React and Vue update and delete actions so hosts can enforce optimistic concurrency independently of the submitted field patch.
- 8ef1329: Add an optional filter bar for catalogue option and boolean columns in React and Vue. The bar uses native column-filter state, searchable multi-selection with filter icons, and the same controls in Options. Showing or hiding the bar preserves filters and saved views.
- 4a530b9: Add configurable read-only record details in React and Vue with typed fields, update metadata, append-only activity, reversible changes, and confirmed deletion.
- 299abc8: Add Shift-click range selection in React and Vue to row checkboxes when multi-row selection is enabled.
- e3ef46d: Drive generated forms, inline editors and filter defaults from one shared column-type contract in React and Vue. Preserve typed option identities and labels, render all dynamic cell types, and add lossless JSON form editing with validation and retryable drafts. Calendar inline edits now emit date-only strings in both editions, matching generated date forms; applications using React inline date schemas should accept `YYYY-MM-DD` values.
- 9d6ddfd: Add independent host-resolved `canEdit` and `canDelete` permissions on saved views in React and Vue. Shared read-only views remain selectable, copyable and eligible as personal favorites. Hosts must continue enforcing authorization in their persistence actions.
- 55447fb: Add XS and 2XL and align all six row densities with Tailwind's spacing scale: 28, 32, 40, 48, 56 and 64px before borders. XS preserves the previous compact S appearance; existing density configuration values remain supported with smoother spacing.

  Use consistent accessible tooltips for table controls, including density, saved views, row actions and column dragging, in React and Vue.

- c6f803f: Keep Create last and primary, persist saved-view density, and compose generated forms with responsive blocks, custom content and asynchronous actions in React and Vue.
- 4babf11: Add `onOpenDetails` in React and Vue so the native View action and row activation can open an application-owned record route or drawer. The callback takes precedence over built-in details and also enables View for read-only tables.
- d455088: Route Vue table operation feedback through the application Sonner toaster, matching React without inserting a status block into the table. Vue consumers must mount one vue-sonner or Shadcn Sonner Toaster at the application root; existing outlets are reused.
- 8b6cf42: Unify React and Vue responsive view menus. Desktop keeps one toolbar row with explicit data actions; mobile and constrained containers use view, create and a labelled data-action panel. View settings adapt to Table, Kanban and Gallery, with direct density and mode controls, accessible scrolling panels, and preserved inactive presentation settings.

  Use normalized saved-view comparisons for the modified indicator and save availability. Add optional `footerCalculationsVisible` snapshots, restore saved or initial settings with Reset view, preserve drafts after persistence failures, and keep favorites independent of write permission. Share the current URL with native mobile sharing and clipboard fallback. Existing filter-only reset flags retain their behavior inside Filters.

  Keep view panels mounted during React query refreshes, use content-sized Shadcn scroll areas, and restore empty grouping without importing an inactive Kanban lane. Preserve utility-column order and native table-cell layout in grouped results. Make the runnable previews apply the complete query and demonstrate actual onBulkEdit writes in both frameworks.

  Keep advanced numeric filter drafts stable until Enter or confirmation, including zero, negative decimals and ranges. Remove stale delayed input callbacks, implicit numeric bounds and nested filter cards. Keep new Vue rules out of query state until applied and expose advanced filters in its runnable example.

  Keep the mobile panel header fixed while focusing numeric inputs and anchor Vue column menus correctly when composed with tooltips.

  Present display mode and density as matching labelled button rows, with equal-width choices and the same selected state in React and Vue.

  Replace bulk field checklists with a searchable property picker and flat editor rows in React and Vue. Preserve partial patches, schema-aware explicit clears, permission checks and failed-row retries. Keep the target count visible on the apply button and actions accessible in the mobile bottom panel. Use record IDs for bulk persistence and map successful results back to their table selection IDs.

### Patch Changes

- 3ca7067: Release from CI instead of by hand. A new **Version and publish** workflow keeps a
  `chore: release vX.Y.Z` pull request current whenever changesets are pending, and tags the
  merged version once `main` carries a described version with no tag. The decision lives in
  `.github/scripts/release-plan.mjs` with its own tests, an existing tag is never republished,
  and the bump still reaches `main` through a reviewed pull request because Pages refuses to
  publish a direct push.
- b977f6f: Use Shadcn dropdown menus for React and Vue footer calculations, with keyboard navigation, selected indicators, and translated Vue labels.
- 21ac4bb: Align grouped row headings, accessor labels, nested record counts, and selection in React and Vue. Preserve leaf cell values and avoid aggregating category IDs in group headings.
- cfa6de2: Align Vue Kanban and Gallery controls with Shadcn-style Reka UI selects, property menus, and checkboxes while preserving saved settings and selection behavior.
- b03b434: Let saved-view labels inherit the dialog font size so compact themes keep the sharing option aligned with the form.
- 2c62022: Align React and Vue toolbar controls at 32px high with 12px regular text, 16px action icons, 12px dropdown chevrons, and square icon buttons. Keep row density independent from toolbar sizing. Fit Table, Kanban, and Gallery buttons inside their segmented frame so hover and selected backgrounds stay centered, preserving keyboard navigation and translated tooltips.

  Refresh the local Shadcn Base Vega Button styles and Tooltip from the official registry, retaining the shared button-variants export and local import aliases. Bring the Vue standalone Button styles and Reka Tooltip composition in line with the official Shadcn Vue Vega sources, including focus states, tooltip arrows, and composed-trigger forwarding.

- d1c888e: Unify Gallery, Kanban and Gantt settings with standard selection controls, one responsive drawer on mobile and scrolling only when needed. Keep density and display choices at normal font weight and align the Share button with other toolbar actions. Move Gantt presentation settings into View settings and present planning dialogs as bottom sheets on mobile.
- 3fe7385: Allow choosing the built-in default view with the favorite star in React and Vue. Clearing the personal favorite marks the default row and toolbar star, while shared/system views remain favoriteable without write permission.
- acd49e5: Align the Vue search toolbar spacing to 16px above and below the controls.
- 570e0f4: Place the optional filter bar above the standard view, search and Options controls in React and Vue, preserving the title and consistent section spacing.
- cfaad15: Ignore equivalent React table-state writes to keep row menus and generated forms stable during refreshes.
- 1008884: Fix React row action and bulk menus flickering by stabilizing controlled table state and column callbacks.
- fd9d305: Document the integrated React and Vue Gantt previews alongside the existing live documentation examples.
- c73b2b9: Refine the shared React and Vue Gantt with a compact toolbar, neutral grid and summary bars, pastel tasks, page icons, a current-date marker, responsive task column and theme-aware planning dialogs. Preserve accessible editing, dependency previews and saved view behavior.
- b060549: Count measured row heights for automatic pagination and keep a stable capacity across variable-height server pages in React and Vue.
- 95ca55d: Load saved views when no initial views are provided.
- 6d9fe3a: Apply React advanced filters to the table instance ID instead of the configuration catalogue key. Tables with distinct `tableId` and `tableType` now filter their own data and saved views, with URL synchronization enabled or disabled.
- 8adf5fd: Fix the copied stack menu import so registry consumers can resolve the responsive view panel after installation.
- db0cabe: Match Vue modal and drawer form backdrops to React with a 10% black overlay and theme-aware 4px background blur.
- d7d6914: Keep automatic pagination stable when shorter content changes the intrinsic table width on a later page. Use the container width for layout identity in React and Vue.
- 02c5ee6: Keep automatic pagination on the selected page when variable column widths change header wrapping. Header/footer measurements affect fit without raising the viewport capacity ceiling in React and Vue.
- 027adef: Align historical filter button heights with saved-view controls across table densities.
- 7814432: Keep inline multi-select choices in a searchable overlay without expanding rows.
  Flush and acknowledge edits before dismissing in React and Vue, retain failed
  drafts for retry, and preserve dismissal requests made during autosave.

  Align removable chips, search, keyboard navigation, density-aware editor heights,
  save-delay/pending feedback, and regular toolbar button typography across editions.

- 58cbfc1: Keep the React URL-state hook's client directive before its Gantt imports so copied registry files compile in Next.js. Vue's equivalent URL-state behavior is unchanged.

## 3.0.0

### Major Changes

- 0749493: Migrate the React and Vue editions to TanStack Table 9.2.4 with matched explicit feature registration. Existing saved views and URLs retain their `left`/`right` pinning format, while consumers must support ESM, target ES2022, and update custom TanStack integrations to version 9.

### Minor Changes

- a017e6f: Add opt-in, accessible column resizing to the React and Vue tables. Resized widths persist in saved views and shareable URLs, while individual columns can remain fixed.

## 2.0.0

### Major Changes

- c4bdd56: Complete the public behavioral parity pass for React and Vue. Both editions now
  share defaults, filter reset semantics, controlled query-persistent selection,
  toolbar actions, column filter/pin/reorder controls, card pagination and empty
  states, and isolated non-URL state. Add the declarative React table picker and
  accessible Vue column and Kanban movement controls. `showResetFilters` now clears
  filters in Vue like React; use the Options reset command to restore presentation
  defaults.

### Minor Changes

- e241eaf: Add opt-in showResetFilters toolbar icon to clear column and advanced filters, global search, and pagination while preserving table presentation and discarding pending filter edits.
- d5e4b86: Add date and radio form field primitives, render text input types, and honor textarea presentation options.
- 8ad796d: Add declarative form sections for grouping existing form fields without custom React renderers.
- 914e88e: Add a declarative Vue table-picker form field with native search, filters,
  sorting, pagination, saved views, and controlled row selection. Selected values
  survive table query changes, support typed IDs, and require no custom form
  renderer.
- fd7e5f1: Align React and Vue list/filter/view contracts and add shared conformance fixtures. React catalogue forms now support generated column fields, conditional fields, asynchronous initialization and options, patch submissions, declarative collections, and a built-in bulk editor with partial-failure retries. Vue cards now paginate, share grouping with the toolbar, render custom cells, and roll back rejected Kanban moves; inline editing honors its debounce. Vue saved views support defaults, system views, dirty state, and recoverable errors. Add the cross-framework `showClearFilters` option while preserving legacy reset behavior. Exclude development tests from the React registry.
- 78ff405: Add native accessible Vue column menus for sorting, hiding and left/right pinning, replacing placeholder diamond glyphs. Column capabilities and mandatory utility-column locks determine the available controls, including the new per-column `enablePinning` permission.

  Allow catalogues to declare toolbar actions, translations, advanced-filter visibility, URL synchronization and server-search debounce defaults. Existing explicit component props retain precedence, including empty toolbar actions and false boolean overrides.

- 9a5e6b9: Generate Vue bulk-edit forms from each table's existing catalogue, with explicit field selection, field validation, per-row permissions, frozen targets, and safe partial-failure retries. Keep consumer callbacks and the JSON editor available for compatibility. Protect selection/actions column locks across saved views and URL state, and align pinned calculation footers. Regenerate the Vue registry distribution with these behaviors.
- 1890621: Fix Vue form draft isolation, asynchronous validation, parsed submissions, nested collection errors, custom field bindings, and catalogue-backed inline editing with rollback on failed updates. Add scoped asynchronous option search and creation, initial-value loading, opt-in patch submission, per-row form selection, translated fields, and isolated collection dialogs. Use Reka UI dialog primitives for portalling, keyboard focus, dismissal, and focus restoration, and include the dependency in the Vue registry.
- 02d85c7: Add the complete Vue 3 edition of YaYaw Table, including the standalone package, shadcn-vue registry artifact, interactive demo, tests, and documentation.
- 17b3003: Bring the Vue toolbar, row actions, and floating bulk actions to React feature parity, including icon mode and permission-aware rendering.
- b2e55f5: Add the optional Vue toolbar filter-reset shortcut through `table.showResetFilters`, matching the React API. Clear search, column filters, advanced filters and pagination without changing presentation or saved-view selection, and provide accessible English/French labels.

### Patch Changes

- 854237b: Allow table configs to use the native JSON and string column renderers.
- 31db5a3: Add a multi-select form field for editing array values from finite option sets.
- d735201: Render multi-select tag values as separate badges instead of a single comma-joined badge.
- b912225: Fix Vue exports across all filtered pages, preserve cross-page selection in React and Vue, and refresh the active page after mutations.
- 74a3561: Align the Vue saved-view manager with React: a compact current-view dropdown, save/add icon buttons, a save dialog, and contextual deletion. Preserve explicit empty grouping so saving or reloading a table view cannot activate its configured Kanban lanes. Restore partial views against catalogue defaults, preserve URL overrides and edits made during asynchronous persistence, pass table context to view actions, and expose recoverable localized errors. Keep legacy Vue translations and local-storage views compatible.
- 3c7125c: Make the Vue toolbar reset shortcut invoke the same handler as the Options menu
  reset. Both clear column and advanced filters, restore configured default sorting
  and column visibility, and remove grouping. They preserve search and unrelated
  presentation state, and use the same `reset` translation for their label and tooltip.
- 1a0e0f2: Fix Vue typed filter editing and keyboard menus, align local-date filtering, and verify shared form and bulk contracts.
- cbe6738: Fix the Vue Options icon being compressed in icon-only toolbars. Keep nested
  Options button spacing at the same CSS specificity as direct toolbar actions so
  the existing icon-only padding rule applies, including when a counter is shown.
  Labeled toolbar buttons retain their existing spacing.
- 597095c: Make declarative table-picker fields inherit the parent table locale and resolved translations by default.
- eb56cb9: Unify table, Kanban, and gallery grouping state.
- 0ac9b33: Fix Vue bulk action callback handling, JSON patch validation, asynchronous locking, and partial-delete refreshes while preserving failed or newly selected rows.
- 39a6fcd: Add the missing Vue column drag-and-drop feature gate and persistent user toggle to match the React table behavior. Publish the maintained Vue example with the registry GitHub Pages site.

## 1.3.0

### Minor Changes

- aef7d4f: Add gallery card buttons to open URL columns and edit rows through the catalogue form.
- abbc7c8: Add a URL-backed Gallery display mode with image columns, gallery toolbar settings, saved-view support, and local product demo media.
- 89f9d16: Add configurable table display modes with a URL-backed Kanban view that can be stored in saved views.
- 49d7ecf: Store Kanban lane, title, property, and label settings in URL-backed saved views.
- 46e984c: Use the Kibo UI Kanban primitives for the table Kanban display mode and render card properties without visible labels by default.
- 7890d9a: Add a saved views manager for YaYaw Table with URL-backed view snapshots and a database-ready view actions contract.
- 3b56a05: Add saved view permissions for saving views and sharing them with a team.

### Patch Changes

- 3e830b7: Honor row interaction permission flags consistently in Kanban and Gallery cards.
- c34a48d: Render unlabeled Kanban and Gallery card properties in a compact two-column grid.
- 16072dd: Align Gallery link buttons with row-link navigation callbacks and update Kanban/Gallery documentation before release.
- 270c85b: Hide custom toolbar actions that require footer calculations when footer calculations are disabled.
- aff6472: Expose Kanban lane grouping in the toolbar by reusing the existing grouping picker.
- 15599eb: Hide stacked grouping controls in single-level group pickers and simplify the Kanban grouping trigger label.

## 1.2.0

### Minor Changes

- f67365e: Add reusable dashboard table UX primitives for layout presets, empty states, active rows, row click modes, and initial data hydration.

### Patch Changes

- 1c1fec0: Fix table initial data hydration so server-paginated tables do not reuse first-page rows after pagination, filtering, search, sorting, or page-size changes.
- 97941be: Fix selection column body cell alignment so row checkboxes stay horizontally aligned with the select-all header checkbox.
- 37e57b1: Apply layout preset defaults inside defineTableConfig before explicit table overrides so nested configs receive the same admin, catalog, and preview defaults as flat provider configs.

## 1.1.1

### Patch Changes

- Document the server-first initial data table options in English and French.

## 1.1.0

### Minor Changes

- Add initial server data options for tables so consumers can hydrate rows, page counts, and row counts before the client query refreshes.

### Patch Changes

- 1459b52: Improve light, dark, and system theme support for the table and site theme picker.

## 1.0.0

### Major Changes

- Promote YaYaw Table to the first stable Shadcn registry release. Versioned registry snapshots now publish under `public/r/v1.0.0/`, with the moving latest registry still available at `/r/yayaw-table.json`.

### Minor Changes

- 76e5936: Add an opt-in catalogue form modal layout with configurable width while keeping the right-side drawer as the default.
- 141a46f: Add a typed `customBulkActions` API for rendering selected-row actions inside the bulk actions menu.
- 4e4468c: Hide pagination controls when the known total fits on one page and remove the legacy direct `DataTablePagination` export. Consumers should use the main `DataTable` API; direct `DataTablePagination` imports are no longer supported.
- 3e9d369: Add a native collection form field for controlled array editing, including row actions, validation, nested collection support, documentation, and tests.
- c02bda4: Add first-class polymorphic table support by separating table ids, table config types, and form config types. Form configs now receive row/value context for dynamic fields, edit forms can resolve their form type per row, toolbar actions receive selected-row context, and standard row actions support row-aware guards.

### Patch Changes

- 767d53c: Restore table config normalization for nested `defineTableConfig` consumers, preserving table options, sort state, translations, and row-aware guards in registry installs.
- b217953: Keep the date-filter calendar internal to the YaYaw Table registry so installs do not overwrite the host app's shadcn calendar component.
- d8e9f57: Disable footer column calculations by default so tables opt in with `enableCalculations: true`.
- 340109b: Avoid `DrawerClose asChild` in the registry form drawer so shadcn base-style transforms do not emit invalid Vaul `render` props.
- 4047011: Fix registry compatibility with react-day-picker v10, restore backward-compatible translation keys for existing consumers, and avoid relying on DialogClose render props in the catalogue form modal.
- 30fee24: Avoid pinning YaYaw Table registry dependencies so updates do not downgrade consumer package ranges.

## 0.3.0

### Minor Changes

- Release the polished French homepage copy and metadata.

## 0.2.0

### Minor Changes

- ae3ce5c: Add Shadcn CLI v4 registry support with optional base and font items, root URL content negotiation, and documented inspection workflows.

### Patch Changes

- c90106b: Add Changesets-based versioning and immutable Shadcn registry release snapshots.

## Unreleased

### Added

- Added Changesets-based SemVer workflow for YaYaw Table registry releases.
- Added immutable Shadcn registry snapshots under `public/r/vX.Y.Z/`.
- Added release verification for version tags and registry snapshots.

### Fixed

- Fixed bulk action confirmation no-op for copy/delete when outside-click events fired while the dialog portal was open.
- Bulk confirm execution is now lock-protected to prevent duplicate handler execution.
- Outside clicks no longer reset the pending bulk action while confirmation is open.

### Changed

- Standardized bulk action result handling around an explicit result object:
  - `success`
  - `closeMenu`
  - `clearSelection`
  - `message?`
- Added stronger runtime guardrails around QueryClient usage to prevent silent cache isolation.

### BREAKING CHANGES

1. **Implicit internal QueryClient removed**

   - YaYaw Table no longer creates a default QueryClient.
   - You must provide a shared `QueryClientProvider` (recommended) or pass a shared `queryClient` explicitly.

2. **Duplicate QueryClient detection**

   - If `queryClient` prop and provider client are both present but different instances, YaYaw Table throws an explicit error.

3. **Bulk callback contract normalization**
   - Legacy return values are still normalized, but explicit `BulkActionResult` is now the recommended contract for deterministic behavior.

### How to migrate in 5 minutes

1. Create a single app-level `QueryClient`.
2. Wrap your app/page with `QueryClientProvider`.
3. Make sure all invalidations target `["tableData", tableId]`.
4. Remove assumptions about internal QueryClient fallback.
5. Update bulk callbacks to return explicit `BulkActionResult`.
