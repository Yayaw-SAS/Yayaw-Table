# Changelog

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
