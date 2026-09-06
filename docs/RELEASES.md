# Release workflow

YaYaw Table is currently distributed as a Shadcn registry block, not as a
published npm package. Versioning therefore has two responsibilities:

- keep a SemVer source of truth in `package.json`;
- publish immutable registry snapshots under `public/r/vX.Y.Z/`.

The moving install URL remains:

```bash
pnpm dlx shadcn@latest add https://table.yayaw.app/r/yayaw-table.json
# or
npx shadcn@latest add https://table.yayaw.app/r/yayaw-table.json
# or
yarn dlx shadcn@latest add https://table.yayaw.app/r/yayaw-table.json
# or
bunx --bun shadcn@latest add https://table.yayaw.app/r/yayaw-table.json
```

Pinned installs use a release snapshot:

```bash
pnpm dlx shadcn@latest add https://table.yayaw.app/r/v1.0.0/yayaw-table.json
# or
npx shadcn@latest add https://table.yayaw.app/r/v1.0.0/yayaw-table.json
# or
yarn dlx shadcn@latest add https://table.yayaw.app/r/v1.0.0/yayaw-table.json
# or
bunx --bun shadcn@latest add https://table.yayaw.app/r/v1.0.0/yayaw-table.json
```

Optional CLI v4 items are published alongside the default block:

```bash
npx shadcn@latest add @yayaw/yayaw-table-base
npx shadcn@latest add @yayaw/font-yayaw-sans
```

## Version policy

YaYaw Table follows SemVer from the root `package.json`. React and Vue are
released together under the same version because they are two editions of one
product.

- `patch`: bug fix or internal cleanup with no consumer migration.
- `minor`: new option, component, helper, or backward-compatible behavior.
- `major`: renamed/removed props, changed imports, changed required providers,
  or any migration that forces consumer code changes.

Every changeset targets `yayaw-table-workspace`. The private Vue package is not
versioned independently; `bun run version` synchronizes its version from the
root package. Validate the complete release plan before merging:

```bash
bun run changeset:status
```

## Release steps

1. Add a changeset for consumer-facing changes:

   ```bash
   bun run changeset
   ```

2. Create the release commit:

   ```bash
   bun run version
   ```

   This runs `changeset version`, synchronizes the Vue package version, updates
   `CHANGELOG.md`, rebuilds the latest registry JSON, and writes every generated
   item into `public/r/vX.Y.Z/`.

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

The tag workflow verifies that the committed versioned snapshot exists for
every registry item and then creates a GitHub release with the registry JSON
files attached. Release notes are generated automatically by GitHub from
merged PRs and commits since the previous release, with the pinned install
command prepended.

## Registry snapshots

`bun run registry:build` updates the latest files in `public/r/`.

`bun run registry:release` updates the latest files and creates the versioned
snapshot for the current `package.json` version. The snapshot includes
`registry.json`, `release.json`, `yayaw-table.json`, `yayaw-table-vue.json`,
`font-yayaw-sans.json`, and `yayaw-table-base.json`.

Versioned snapshots are immutable. If any file under `public/r/vX.Y.Z/` already
exists with different content, bump the version before releasing. Use
`ALLOW_VERSION_SNAPSHOT_OVERWRITE=1 bun run registry:snapshot` only for a
deliberate repair of an unpublished or broken snapshot.
