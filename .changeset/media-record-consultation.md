---
"yayaw-table-workspace": minor
---

Add equivalent React and Vue gallery media viewers with image/video/audio/PDF previews, separate record information actions, muted hover video, native playback, navigation, and accessible focus restoration. Add S/M/L preview height independently of card width, neutral or colored tags, and content-sized action menus.

Support modified gallery selection and scoped Ctrl/Cmd+A across matching pages. Connect Ctrl/Cmd+Z to existing record activity and onRevertActivity, including deleted records supplied through details.history and grouped compensating events through transactionId. Applications retain responsibility for persistence, permissions and reversible deletion. Add video record fields and custom rowActions in both editions.

Vue now defaults to the same wide gallery ratio and colored tags as React. Set aspectRatio: "square" and coloredTags: false explicitly to preserve its previous appearance. Runtime media callbacks stay out of saved views; previewSize is persisted.
