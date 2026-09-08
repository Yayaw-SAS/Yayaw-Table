import { describe, expect, it } from 'bun:test';
import { act, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { mockAutoPageLayout } from '../../../../../tests/fixtures/auto-page-layout';
import { useAutoPageSize } from './use-auto-page-size';

describe('React automatic pagination', () => {
  it.each([false, true])('resizes, respects fixed choices and cleans up (default auto: %s)', async (defaultAutomatic) => {
    const layout = mockAutoPageLayout(window);
    const host = document.createElement('div'); document.body.append(host);
    const app = createRoot(host);
    function Harness({ density = 'medium', view = 'default' }: { density?: string; view?: string }) {
      const root = useRef<HTMLDivElement>(null);
      const [pageSize, setPageSize] = useState(10);
      const state = useAutoPageSize({ root, tableId: `automatic-test-${defaultAutomatic}`, enabled: true, defaultAutomatic, resetKey: view, measurementKey: density, pageSize, setPageSize });
      return <div ref={root}>
        <table><tbody><tr><td>Record</td></tr></tbody></table>
        <footer data-yayaw-pagination=""><select aria-label="Rows per page" value={state.automatic ? 'auto' : String(pageSize)} onChange={event => state.selectSize(event.target.value)}><option value="auto">Automatic</option><option value="20">20</option><option value={pageSize}>{pageSize}</option></select><output>{pageSize}</output></footer>
      </div>;
    }
    const flush = async () => { await act(async () => { layout.flush(); }); };
    const select = async (value: string) => { await act(async () => { const element = host.querySelector('select')!; element.value = value; element.dispatchEvent(new Event('change', { bubbles: true })); }); };
    try {
      await act(async () => { app.render(<Harness />); }); await flush();
      expect(host.querySelector('select')?.value).toBe(defaultAutomatic ? 'auto' : '10');
      await select('auto'); await flush();
      expect(host.querySelector('output')?.textContent).toBe('9');
      expect(host.querySelector('select')?.value).toBe('auto');
      // Server query loading can temporarily replace the table with a skeleton.
      await act(async () => { app.render(<div>Loading</div>); });
      await act(async () => { app.render(<Harness />); }); await flush();
      expect(host.querySelector('select')?.value).toBe('auto');
      // Shorter content also narrows an intrinsic-width table on the next page.
      layout.tableWidth(700);
      layout.bodyTop(148);
      layout.rowHeight(20); layout.resize(600); await flush();
      expect(host.querySelector('output')?.textContent).toBe('9');
      layout.bodyTop(132);
      layout.rowHeight(40);
      layout.resize(800); await flush();
      expect(host.querySelector('output')?.textContent).toBe('14');
      layout.rowHeight(20);
      await act(async () => { app.render(<Harness density="small" />); }); await flush();
      expect(host.querySelector('output')?.textContent).toBe('29');
      expect(host.querySelector('select')?.value).toBe('auto');
      await select('20'); layout.resize(600); await flush();
      expect(host.querySelector('output')?.textContent).toBe('20');
      await select('auto'); await flush();
      await act(async () => { app.render(<Harness density="small" view="another" />); }); await flush();
      expect(host.querySelector('select')?.value === 'auto').toBe(defaultAutomatic);
    } finally {
      await act(async () => { app.unmount(); });
      layout.resize(900); expect(layout.pending()).toBe(0);
      layout.restore(); host.remove();
    }
  });
});
