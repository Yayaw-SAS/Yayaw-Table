import { expect, it } from "bun:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "bun";

for (const timezone of ["America/Los_Angeles", "Europe/Paris"]) {
  it(`uses local calendar dates for native date inputs in ${timezone}`, () => {
    const source = pathToFileURL(
      resolve("src/components/ui/yayaw-table/utils/table-contracts.ts")
    ).href;
    const result = spawnSync(
      [
        process.execPath,
        "-e",
        `
      import { matchesContractFilter } from ${JSON.stringify(source)};
      const values = [
        matchesContractFilter(new Date(2026, 8, 4, 12), { type: 'date', operator: 'equals', values: '2026-09-04' }),
        matchesContractFilter(new Date(2026, 8, 5, 23), { type: 'date', operator: 'between', values: ['2026-09-04', '2026-09-05'] }),
        matchesContractFilter(new Date(2026, 8, 3, 23), { type: 'date', operator: 'equals', values: '2026-09-04' })
      ];
      console.log(JSON.stringify(values));
    `,
      ],
      { env: { ...process.env, TZ: timezone } }
    );
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toEqual([true, true, false]);
  });
}
