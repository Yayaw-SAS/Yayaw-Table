# Dashboard widget visual review

## Findings and changes

The baseline mixed large rounded card shells, a divider under every widget title,
and dense settings with equally emphasized labels. In an embedded narrow panel,
a dashboard name shared its line with actions and was reduced to a few letters.
The React and Vue mobile editor footers also used different arrangements.

The updated presentation follows the table settings hierarchy:

- A wrapping dashboard name, semibold section headings, and medium widget titles.
  Long widget titles use up to two lines; actions move below a long page name when
  space is limited. The semantic h2/h3/h4 relationships are preserved.
- Compact card corners, no decorative shadow or header divider, and consistent
  content alignment. KPI values remain dominant over their muted titles and
  comparisons. Compact loading/error feedback is retained for single-row cards.
- The widget title comes first in settings, followed by Source, Calculation, and
  Period and comparison groups. Field labels are muted and checkboxes reuse the
  table primitives.
- The editor heading and footer remain visible while its fields scroll. On small
  screens, comparison fields and actions stack consistently in React and Vue.

## Visual evidence

The reproducible harness is documented in [`scripts/visual/README.md`](../../scripts/visual/README.md).
The baseline uses commit `e58db692` (published 3.9.3 components); screenshots were
captured from isolated local demo browsers, not an authenticated production page.

Before: `/tmp/yayaw-dashboard-visual-before` (64 PNGs).
After: `/tmp/yayaw-dashboard-visual-after` (72 PNGs, including the lower mobile
settings fields). Coverage includes React/Vue, 1440px/390px, light/dark, reading
and editing, grid/flow sections, and long titles within an embedded host panel.

The 18 capture scenarios passed. No page or dialog exceeded its viewport.
A 158px card previously gave the 129px revenue figure only 65px; narrow cards
now reserve that width for the figure and visually compact the optional trend
while retaining its accessible description. The comparison percentage fits;
its contextual suffix may ellipsize in this smallest card. Values and comparison
rows remain inside the 108px card height, including with a two-line title.
The lower settings controls and Apply action were inspected together on mobile.

## Regression checks

The shared browser suite covers both languages and frameworks: title-first form
order, accessible groups and checkboxes, preserved drafts through scrolling and
reopening, stationary dialog headers/footers, and long titles on a 390px screen.
The complete release gate passed (1,387 React, 1,185 Vue, 448 Chromium cases).
After the final narrow-card spacing correction, both new browser regressions
passed; lint, registry generation and the visual scenarios were checked again.
CI validates the final commit with all 450 browser cases before merging.

Yayaw application content changes and protected bilingual guide updates are
tracked in [Yayaw #1279](https://github.com/Yayaw-SAS/Yayaw/pull/1279).
