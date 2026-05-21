# Changelog

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
