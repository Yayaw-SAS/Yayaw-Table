---
"yayaw-table-workspace": patch
---

URL sync (React and Vue): the URL now carries only what differs from the table's defaults.
- Column visibility only lists the columns shown or hidden differently, and a link's visibility is merged over the defaults.
- Order and pinning leave out the locked `select` and `actions` columns.
- The page size is not written while it is automatic.

Before this, every change wrote the whole column state, about 1.5 kB of JSON. Pages send their URL as the Referer of every request, and a host's WAF read `"select"` … `"accountManagers"` in it as SQL injection and banned users' IPs. Old full links still read, and React rewrites them in the compact form.
