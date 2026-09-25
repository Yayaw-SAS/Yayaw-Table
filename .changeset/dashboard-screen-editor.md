---
"yayaw-table-workspace": minor
---

Dashboards get their screen editor, the same in React and Vue, and tables report their view.

- **Tables report their view**: React `DataTable` takes `onViewConfigChange(config)`; Vue `YayawDataTable` emits `view-config-change` and exposes `getViewConfig()`; `ToolbarActionContext.getViewConfig()` in both. The config is `canonicalViewConfig()` (new in `view-config.ts`): saved-view settings sanitized like `sanitizeViewConfig`, without the `select` and `actions` columns, keys in one order. It is reported when the table starts and after each change, once per distinct view.
- **Sections**: "Add section" (a grid of cards, full width). In edit mode each section has a bar with its title and a menu (Move up, Move down, "Add widget here", Remove, confirmed when the section holds widgets). Widgets move to another section from their menu ("Move to section").
- **The widget dialog** replaces the add-widget dialog, to add and to edit, in three steps: what (a number, a view, a table page, a note, the host's blocks by group and placement), the source (the host's catalogue from `sources.list()`, searched and grouped, unavailable sources disabled with their reason), the settings (the default, a saved or a custom view; the number and overflow fields; the title; a block's `settings` component, or its props as JSON checked by the block's `validateProps`).
- **"Edit view…"**: a near full-screen dialog whose editor is the source's live table (toolbar, filters, sort, columns, every mode's settings; no URL sync, saved views, selection or writes). "Apply" stores its last report, sanitized, in `widget.view`, without the page size unless it changed; closing with changes asks first.
- **"Use a copy of this view"** turns a saved view into the widget's inline view; **"Make the current view the screen default"** stores a full-page table's current view.
- **Saving**: "Done" checks the document with `validateDashboard` and the host's blocks. Errors keep edit mode and are listed by widget, section or filter; nothing is saved.
- **Loading**: the editor is a chunk of its own, imported when edit mode starts; readers never download it.
- The rules are pure, in the new server-safe `dashboard-editor-model.ts` (synced to Vue). `dashboard-schema.ts` adds `checkDashboardBlockProps` and exports `dashboardAcceptedSections`; `addDashboardWidget` and `moveWidgetToSection` take `blocks`. EN/FR labels for the editor.
- The React item now needs shadcn `alert-dialog` and `command`.

**Migration.** React's `AddWidgetDialog` (`dashboard-dialogs.tsx`) and Vue's `DashboardAddWidget.vue` are replaced by the widget dialog. `ToolbarActionContext` has `getViewConfig()`: code that builds the context itself (tests) adds it. See `docs/DASHBOARD-SCREENS.md`.
