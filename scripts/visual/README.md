# Dashboard visual review

This optional harness captures the local React and Vue examples on desktop and mobile, in light and dark themes. It includes dashboard editing, widget selection, KPI settings, view settings, the view editor, grid and flow sections, and long titles inside a narrow host panel. A revenue KPI combines a long title, value, comparison and trend in both a narrow host panel and a one-column desktop card; recorded bounds check that the value remains complete and the comparison fits vertically. The host panel is a test-only wrapper; the section fixture preserves the existing demo's unavailable `home.summary` block.

Run it explicitly from the repository root:

```sh
E2E_REACT_PORT=5196 E2E_VUE_PORT=5197 \
DASHBOARD_VISUAL_CAPTURE_DIR=/tmp/yayaw-dashboard-visual-after \
bun x playwright test --config scripts/visual/playwright.config.ts --workers=2
```

The default capture directory is `/tmp/yayaw-dashboard-visual-before`. PNG files and matching layout measurements stay outside the repository. Test traces use `/tmp/yayaw-dashboard-visual-results` by default; override `DASHBOARD_VISUAL_RESULTS_DIR` to preserve separate runs.

The normal `playwright.config.ts` only discovers `e2e/`, so the release gate neither registers nor skips these capture cases. The harness uses fresh local test contexts and does not access personal browser sessions.

Full-page captures first establish the final viewport height and wait for responsive data reloads to settle. This avoids capturing transient loading states introduced by the screenshot viewport resize.
