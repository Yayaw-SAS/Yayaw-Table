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
bun run changeset:check
bun run changeset:status
```

`changeset:check` validates pending release targets and remains valid after a
release has consumed the Changesets. `changeset:status` previews the next
version while Changesets are still pending.

## Release steps

Merge twice. Nothing is run locally, and the version number is worked out for
you.

1. Optionally add a changeset when you want to write the changelog entry
   yourself:

   ```bash
   bun run changeset
   ```

   Without one, the version comes from the conventional commits merged since the
   last tag: `feat` asks for a minor, `fix`, `perf`, `refactor` and `revert` for
   a patch, and a `!` marker for a major. `build`, `chore`, `ci`, `docs`, `style`
   and `test` ship nothing to a consumer, so they release nothing. A subject that
   does not follow the convention is never guessed at; it is named in the job
   log and ignored. A changeset always wins over the derived bump, because its
   prose is better than a list of subjects.

2. Merge that work into `main`. The **Version and publish** workflow applies
   every pending changeset on a `changeset-release/main` branch and opens (or
   refreshes) a `chore: release vX.Y.Z` pull request. That pull request carries
   the version bump, the synchronized Vue version, `CHANGELOG.md` and the
   versioned snapshot under `public/r/vX.Y.Z/`, and runs the usual CI.

   Changesets merged afterwards refresh the same pull request, so releases stay
   batched: it waits until you decide to publish.

3. Merge the release pull request. `main` then carries a described version with
   no tag, so the same workflow verifies the committed snapshot and pushes the
   `vX.Y.Z` tag. The tag workflow attaches the pinned registry items to a
   GitHub release, with notes generated from the merged pull requests.

The workflow decides between those two steps with
`.github/scripts/release-plan.mjs`, which is covered by
`.github/scripts/release-plan.test.mjs` and runs in CI. An existing tag is
never republished, and a malformed version stops the release rather than
tagging it. A release derived from commits is materialized as a changeset on
the version branch, so `changeset version`, `CHANGELOG.md` and
`changeset:check` all see the same thing whichever way the number was reached.

Pages refuses to publish a commit that is not the merge of exactly one pull
request, so the version bump is never pushed to `main` directly; only the tag
is. Never push a release commit to `main`.

Opening the release pull request needs **Allow GitHub Actions to create and
approve pull requests** under Settings > Actions > General. Without it the
workflow still applies the changesets and pushes `changeset-release/main`, then
prints a compare link in its job summary for a maintainer to open once; the
release itself is unaffected.

### Releasing by hand

`workflow_dispatch` re-runs the same decision without waiting for a push, which
is the first thing to try if a release stalls. The local equivalent remains
available for a repair:

```bash
bun run version          # apply changesets, sync Vue, snapshot the registry
bun run release:check    # full distribution gate
bun run release:verify   # verify the versioned snapshot
```

Commit the result on a branch, open a pull request and merge it; the workflow
tags the merged version.

## Registry snapshots

`bun run registry:build` updates the latest files in `public/r/` locally.
Pages serves the immutable build artifact from the validated PR; no bot commits
generated files to `main` after deployment. See [CI maintenance](CI-MAINTENANCE.md)
for artifact retention and publication recovery.

`bun run registry:release` updates the latest files and creates the versioned
snapshot for the current `package.json` version. The snapshot includes
`registry.json`, `release.json`, `yayaw-table.json`, `yayaw-table-vue.json`,
`font-yayaw-sans.json`, and `yayaw-table-base.json`.

Versioned snapshots are immutable. If any file under `public/r/vX.Y.Z/` already
exists with different content, bump the version before releasing. Use
`ALLOW_VERSION_SNAPSHOT_OVERWRITE=1 bun run registry:snapshot` only for a
deliberate repair of an unpublished or broken snapshot.
