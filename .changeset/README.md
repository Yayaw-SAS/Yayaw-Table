# Changesets

Use `bun run changeset` for consumer-facing changes to YaYaw Table.

This repo does not publish an npm package today. Changesets is used to choose
the next SemVer version, update `package.json`, and maintain `CHANGELOG.md`.

The private Vue package follows the same release version. The root `version`
script synchronizes `packages/yayaw-table-vue/package.json` after Changesets
updates the root package.
The Shadcn registry release is then generated with `bun run registry:release`.
