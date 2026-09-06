# Changesets

Use `bun run changeset` for consumer-facing changes to YaYaw Table.

This repo does not publish an npm package today. Changesets is used to choose
the next SemVer version, update `package.json`, and maintain `CHANGELOG.md`.

The private Vue package follows the same release version. The root `version`
script synchronizes `packages/yayaw-table-vue/package.json` after Changesets
updates the root package.
The Shadcn registry release is then generated with `bun run registry:release`.

Every changeset must target `yayaw-table-workspace`. Do not target the private
`@yayaw/table-vue` package directly: it is not an independently versioned
workspace, and its version is synchronized from the root package during a
release. Run `bun run changeset:status` before committing a changeset so an
invalid package name cannot block the release plan. CI and the full release
gate run `bun run changeset:check`, which also works after `changeset version`
has consumed every pending changeset.
