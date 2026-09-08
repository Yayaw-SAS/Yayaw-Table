import { describe, expect, it } from 'bun:test';
import cases from '../../../../../tests/fixtures/auto-page-size.json';
import { fitPageSize, fitMeasuredPageSize } from './auto-page-size';

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
});
