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

## Verification

Run `actionlint` on the workflows and let the PR's existing CI build the
registry and Vue example. After merge, verify that both Pages jobs succeed,
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
