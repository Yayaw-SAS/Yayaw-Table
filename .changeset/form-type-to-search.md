---
"yayaw-table-workspace": patch
---

In forms, a letter or other printable character typed on the closed button of a searchable select or multiSelect (including one with `searchOptions`) now opens its list with the search started with that character, the search focused and the caret after it, so typing goes on there; before, the list opened with an empty search and the character was lost. Space, Enter and the arrows keep their behavior, and Ctrl, Cmd and Alt shortcuts, IME composition and disabled fields are left alone. In the Vue edition, Tab now also reaches the button of a searchable field, which Reka's combobox had left out of the Tab order.
