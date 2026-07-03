import { build } from 'esbuild';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './lib/config.js';

/**
 * Transpiles the tsc ESM output (dist/esm) to CommonJS (dist/cjs).
 * TypeScript 6 deprecated the node10 moduleResolution the old tsc CJS pass
 * relied on; esbuild keeps the same file-per-module layout and resolves the
 * `./x.js` relative specifiers as-is.
 */
function collectJs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectJs(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

async function main(): Promise<void> {
  const esmDir = join(REPO_ROOT, 'dist', 'esm');
  const entryPoints = collectJs(esmDir);
  if (entryPoints.length === 0) {
    console.error('dist/esm is empty — run build:esm first.');
    process.exit(1);
  }
  await build({
    entryPoints,
    outdir: join(REPO_ROOT, 'dist', 'cjs'),
    outbase: esmDir,
    format: 'cjs',
    platform: 'node',
    target: 'node24',
    logLevel: 'error',
  });
  console.log(`build:cjs OK (${entryPoints.length} modules)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
