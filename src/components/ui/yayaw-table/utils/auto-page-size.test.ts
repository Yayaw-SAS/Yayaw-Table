import { describe, expect, it } from 'bun:test';
import { mockAutoPageLayout } from "../../../../../tests/fixtures/auto-page-layout";
import cases from '../../../../../tests/fixtures/auto-page-size.json';
import { fitPageSize, fitMeasuredPageSize, observeAutoPageSize } from './auto-page-size';

describe('automatic pagination capacity', () => {
  for (const test of cases) {
    it(`fits ${test.expected} rows into ${test.availableHeight}px at ${test.rowHeight}px per row`, () => {
      expect(fitPageSize(test.availableHeight, test.rowHeight)).toBe(test.expected);
    });
  }
  it('rejects non-finite geometry without sending an invalid server page size', () => {
    expect(fitPageSize(Number.NaN, 40)).toBe(1);
    expect(fitPageSize(400, Number.POSITIVE_INFINITY)).toBe(1);
  });
});

// A wrapped first row must not reserve its extra height for every other row.
it('fits mixed row heights without multiplying the tallest row', () => {
  expect(fitMeasuredPageSize(360, [108, 41, 41, 41, 41, 41, 41, 41])).toBe(7);
  expect(fitMeasuredPageSize(360, [108, 41, 41])).toBe(7);
  expect(fitMeasuredPageSize(50, [108, 41])).toBe(1);
  expect(fitMeasuredPageSize(50, [])).toBe(1);
  // A tall third row no longer stops the page at the two rows above it.
  expect(fitMeasuredPageSize(500, [60, 60, 400, 60])).toBe(7);
  expect(fitMeasuredPageSize(100, [60, 400])).toBe(1);
});

it("keeps a scrolling dialog as the reference once its rows fit", () => {
  const layout = mockAutoPageLayout(window);
  const dialog = document.createElement("div");
  const root = document.createElement("div");
  const table = document.createElement("table");
  table.createTBody().insertRow().insertCell();
  root.append(table);
  dialog.style.overflowY = "auto";
  dialog.append(root);
  document.body.append(dialog);

  let scrollHeight = 360;
  Object.defineProperties(dialog, {
    clientHeight: { value: 300 },
    scrollHeight: { get: () => scrollHeight },
  });
  const sizes: number[] = [];
  const stop = observeAutoPageSize(root, ({ pageSize }) => sizes.push(pageSize));
  try {
    layout.flush();
    scrollHeight = 300;
    layout.resize(600);
    layout.flush();
    expect(sizes).toEqual([4, 4]);

    dialog.style.overflowY = "visible";
    layout.resize(600);
    layout.flush();
    expect(sizes).toEqual([4, 4, 9]);
  } finally {
    stop();
    dialog.remove();
    layout.restore();
  }
});
