---
"yayaw-table-workspace": patch
---

CI, release and registry workflows now run on Node 26, and the dev typings use `@types/node` 26. The Vue test runner disables Node's built-in `localStorage` (on by default since Node 25) so the tests keep using jsdom's storage. No change to the React or Vue components.
