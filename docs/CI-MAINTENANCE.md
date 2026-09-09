# CI runtime maintenance

The registry and Vue example are static artifacts published by
`.github/workflows/deploy-registry-pages.yml` to GitHub Pages. They do not run
on the Yayaw application's Coolify server.

## GitHub Actions runtime

A JavaScript action's runtime comes from its own `action.yml` declaration.
Installing Node with `actions/setup-node`, changing the runner's system Node,
or updating Coolify does not change that declaration.

The Pages workflow uses the Node 24 action releases:

| Action | Major version | Runtime |
| --- | --- | --- |
| `actions/configure-pages` | 6 | Node 24 |
| `actions/upload-pages-artifact` | 5 | Composite action using `actions/upload-artifact` 7 on Node 24 |
| `actions/deploy-pages` | 5 | Node 24 |

The previous Pages actions declared Node 20. GitHub reported a deprecation
warning even while forcing those actions to execute on Node 24. Updating all
three actions also updates the artifact uploader nested inside the composite
action. A runner environment override would leave those old declarations in
place.

Keep the Pages artifact name and its build/deploy dependency aligned when
updating these actions. The upload path remains `dist/registry-pages`, and the
deployment uses the default `github-pages` artifact. The workflow runs on
GitHub-hosted Ubuntu runners; no Coolify host upgrade is needed for this change.

## Validate once, publish the same artifact

`CI tests` runs only for opened, updated, or reopened PRs targeting `main`.
It checks out the explicit PR head, cancels superseded runs for that PR, and
keeps one `test-and-typecheck` job with a ten-minute timeout. Node 24 and Bun
1.4.2 (the version observed in successful runs) are explicit. The job retains
Changeset validation, TypeScript, React tests, the intentional repeated-menu
stability regression, Vue tests, the Vue package build, and registry/example
generation. The menu reruns detect lifecycle instability and are not redundant
quality jobs.

The job builds `dist/registry-pages` once, validates it, and uploads the Pages
tarball as `registry-pages-<PR head SHA>-<run attempt>` for 30 days. Failed checks
prevent upload. Both dependency installations remain necessary because React
and Vue have separate lockfiles. Together they took about five seconds in the
baseline run, so adding a separate dependency-cache action is not justified by
that measurement.

After a push to `main`, the Pages workflow:

1. Requires one merged PR associated with the immutable target commit and
   exactly matching Git trees for its head and the merged commit.
2. Requires the latest PR CI run and its `test-and-typecheck` job to succeed.
   An older green run cannot override a newer pending or failed run.
3. Resolves the unexpired artifact for that run's latest attempt, checking its
   run ID, source head and SHA-256 digest metadata. Fork PRs remain supported;
   their CI must run in this repository and their merged tree must match.
4. Downloads only that artifact by ID with digest mismatches treated as errors.
   The tarball is never extracted or executed by the privileged publication job.
5. Rechecks current `main` and the selected artifact before publication, then
   transfers the unchanged tarball into the publication run and deploys it.
   GitHub Pages requires the artifact in the deploying workflow run.

Publication performs no application installation, type checks, tests, or
registry build. The old `Build registry` workflow and its automatic generated
commits to `main` are removed. Generated registry sources remain local reviewed
build outputs; the served latest JSON and Vue example come from the validated
PR artifact. Versioned release snapshots remain committed and immutable.

The `github-pages` concurrency group serializes publication without cancelling
an in-flight deployment. Obsolete targets exit successfully without publishing.
A push arriving after the final freshness check is handled by the next queued
publication; Git updates and Pages deployment are not one atomic operation.

## Recovery and adoption

Before merging, wait for `test-and-typecheck` and update the PR with current
`main` if necessary. A direct push, merge conflict resolution that changes the
validated tree, or missing PR validation blocks publication. Repair those cases
through a fresh validated PR from current `main`; there is no main-branch test
fallback.

If a 30-day artifact expired or was deleted, rerun the original PR CI to create
an artifact for its new attempt, then rerun Pages from current `main`. If that
PR used the legacy workflow without artifact upload, create a fresh PR carrying
the current workflow. Keep the first adoption PR current before merging so its
own new artifact can authorize the first publication.

The manual Pages workflow only accepts `main` and uses the same validation and
freshness rules as a push. It cannot rebuild, bypass validation, or roll back to
an arbitrary old SHA. CI checks can be rerun from their existing PR run; there
is no separate manual quality workflow on `main`.

The tag release workflow retains the committed snapshot/version checks and
GitHub release creation. Those checks use only Node's standard library, so the
tag workflow no longer installs application dependencies or Bun. Release
commits must arrive through a validated PR before tagging; see
[Release workflow](RELEASES.md).

## Baseline and verification

Before these changes, PR run `34368058764` completed in 1m46 including scheduling
(1m42 for the job). The static registry build took eight seconds. A normal merge
started three independent workflows: a second quality run, a registry build
that could write generated commits, and a separate Pages build/deployment. Pages
could therefore publish before the repeated quality run finished. The main
improvement is removal of duplicate work and requiring publication to use
validated output; measure PR time and publication time separately after rollout.


Run `actionlint` on the workflows and run `node --test .github/scripts/*.test.mjs`. Let the PR CI build the
registry and Vue example. After merge, verify that the Pages publication job succeeds,
the published registry and example are accessible, and the Node 20 annotation
has disappeared from the new run. Historical run annotations remain visible.

## Maintenance boundaries

Review action releases and nested composite-action dependencies together.
Prepare updates as PRs and validate them before merging. Keep this separate
from Coolify, Docker, operating-system, or database maintenance: an application
deployment does not upgrade those services.

References:

- [GitHub Actions Node 20 deprecation](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)
- [Configure Pages v6](https://github.com/actions/configure-pages/releases/tag/v6.0.0)
- [Upload Pages artifact v5](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0)
- [Deploy Pages v5](https://github.com/actions/deploy-pages/releases/tag/v5.0.1)

- [Cross-run artifact downloads](https://github.com/actions/download-artifact#download-artifacts-from-other-workflow-runs-or-repositories)
- [GitHub artifact metadata](https://docs.github.com/en/rest/actions/artifacts)
