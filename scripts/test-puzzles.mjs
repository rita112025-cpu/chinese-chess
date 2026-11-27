// 以 esbuild 打包 TypeScript 測試後交給 node:test 執行（不新增執行期相依）。
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outdir = mkdtempSync(join(tmpdir(), 'puzzle-tests-'));
await build({
  entryPoints: ['tests/puzzles.test.ts'], bundle: true, platform: 'node', format: 'esm',
  outfile: join(outdir, 'puzzles.test.mjs'), logLevel: 'error',
});
const result = spawnSync(process.execPath, ['--test', join(outdir, 'puzzles.test.mjs')], { stdio: 'inherit' });
process.exit(result.status ?? 1);
