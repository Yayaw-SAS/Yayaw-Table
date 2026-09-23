---
"yayaw-table-workspace": minor
---

Data gets its own toolbar button (database icon), next to View settings, in React and Vue: its menu lists Export ›, Connect › and Share ›, with the same screens as before, and on touch layouts the application toolbar actions. View settings now hold presentation only. The bulk bar's Export opens the Export screen of this menu. "Sync" is renamed "Connect": destinations use `kind: "connect"` (`"sync"` and `"export"` are still accepted) and the translation key is `destinations.connect` ("Connect" / "Connecter").
