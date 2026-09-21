---
"yayaw-table-workspace": patch
---

Release from CI instead of by hand. A new **Version and publish** workflow keeps a
`chore: release vX.Y.Z` pull request current whenever changesets are pending, and tags the
merged version once `main` carries a described version with no tag. The decision lives in
`.github/scripts/release-plan.mjs` with its own tests, an existing tag is never republished,
and the bump still reaches `main` through a reviewed pull request because Pages refuses to
publish a direct push.
