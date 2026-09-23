---
"yayaw-table-workspace": minor
---

Share number and date formatting between React and Vue. Number columns accept `numberFormat` with `style` (`decimal`, `currency`, `percent`, `compact`, `unit`), `currency`/`currencyDisplay`, `unit`/`unitDisplay`, fixed or bounded decimals, custom separators, `prefix`/`suffix`, `signDisplay`, accounting `negative: "parentheses"`, `percentBase`, and a progress `display: "bar"` against `max`; the earlier React presets and Vue options keep working. Date columns offer all 17 presets in both editions, plus `timeZone` and `hour12`; `"relative"` is localized. React now reads date-only values such as "2026-09-10" as local calendar days, fixing dates shown one day early west of UTC.
