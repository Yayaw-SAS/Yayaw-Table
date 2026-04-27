# Changelog

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
