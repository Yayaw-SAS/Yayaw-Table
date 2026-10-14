---
"yayaw-table-workspace": minor
---

Connector screens can work with the person's own account and the provider's picker, in React and Vue. `connector.account` (`status`, `connect`, `disconnect?`) shows "Connect your account" until the account is connected, then "Connected as …" with Disconnect; `connector.pickTarget` adds a "Browse…" button whose picker returns the target. Both are optional; existing connectors are unchanged.
