# Release workflow

YaYaw Table is currently distributed as a Shadcn registry block, not as a
published npm package. Versioning therefore has two responsibilities:

- keep a SemVer source of truth in `package.json`;
- publish immutable registry snapshots under `public/r/vX.Y.Z/`.

The moving install URL remains:

```bash
pnpm dlx shadcn@latest add https://table.yayaw.eu/r/yayaw-table.json
# or
npx shadcn@latest add https://table.yayaw.eu/r/yayaw-table.json
# or
yarn dlx shadcn@latest add https://table.yayaw.eu/r/yayaw-table.json
# or
bunx --bun shadcn@latest add https://table.yayaw.eu/r/yayaw-table.json
```

Pinned installs use a release snapshot:

```bash
pnpm dlx shadcn@latest add https://table.yayaw.eu/r/v0.1.0/yayaw-table.json
# or
npx shadcn@latest add https://table.yayaw.eu/r/v0.1.0/yayaw-table.json
# or
yarn dlx shadcn@latest add https://table.yayaw.eu/r/v0.1.0/yayaw-table.json
# or
bunx --bun shadcn@latest add https://table.yayaw.eu/r/v0.1.0/yayaw-table.json
```

## Version policy

Stay on `0.x` until the public API is stable enough for `1.0.0`.

- `patch`: bug fix or internal cleanup with no consumer migration.
- `minor`: new option, component, helper, or backward-compatible behavior.
- `major`: renamed/removed props, changed imports, changed required providers,
  or any migration that forces consumer code changes.

While the package is below `1.0.0`, breaking consumer changes should usually be
released as a `minor` bump and clearly documented as breaking in the changelog.

## Release steps

1. Add a changeset for consumer-facing changes:

   ```bash
   bun run changeset
   ```

2. Create the release commit:

   ```bash
   bun run version
   ```

   This runs `changeset version`, updates `CHANGELOG.md`, rebuilds the latest
   registry JSON, and writes `public/r/vX.Y.Z/yayaw-table.json`.

3. Verify before tagging:

   ```bash
   bun run release:check
   bun run release:verify
   ```

4. Commit the release files and tag the same version:

   ```bash
   git tag vX.Y.Z
   git push origin main --tags
   ```

The tag workflow verifies that the committed versioned snapshot exists and then
creates a GitHub release with the registry JSON attached. Release notes are
generated automatically by GitHub from merged PRs and commits since the
previous release, with the pinned install command prepended.

## Registry snapshots

`bun run registry:build` updates the latest files in `public/r/`.

`bun run registry:release` updates the latest files and creates the versioned
snapshot for the current `package.json` version.

Versioned snapshots are immutable. If `public/r/vX.Y.Z/yayaw-table.json` already
exists with different content, bump the version before releasing. Use
`ALLOW_VERSION_SNAPSHOT_OVERWRITE=1 bun run registry:snapshot` only for a
deliberate repair of an unpublished or broken snapshot.
