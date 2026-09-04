---
"yayaw-table-workspace": patch
---

Fix the Vue Options icon being compressed in icon-only toolbars. Keep nested
Options button spacing at the same CSS specificity as direct toolbar actions so
the existing icon-only padding rule applies, including when a counter is shown.
Labeled toolbar buttons retain their existing spacing.
