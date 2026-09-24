---
"yayaw-table-workspace": patch
---

Install every shadcn component the React table uses.

- **Missing registry dependencies** (React registry): the table imports shadcn's `card` (Kanban cards) and `combobox` (inline cell editing) but its registry item did not declare them, so a clean `shadcn add` of the table did not install them and the project did not compile until they were added by hand. Both are now declared.
- **Inline type imports** (React registry): two type annotations still imported the table through the `@/components/ui/yayaw-table` alias. They now use relative paths like every other import, so projects with other aliases type-check.
- **Build guard**: the registry build now fails when an item imports a shadcn component it does not declare, so this cannot regress unnoticed.
