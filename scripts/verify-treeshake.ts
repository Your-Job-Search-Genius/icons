import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './lib/config.js';

/**
 * Bundles a one-liner that imports a single icon from the built ESM barrel
 * and asserts the output stays tiny (i.e. the other ~7000 icons were shaken
 * out) and contains no other icon's name.
 */
async function main(): Promise<void> {
  const manifest: Array<{ componentName: string }> = JSON.parse(
    readFileSync(join(REPO_ROOT, 'manifest.json'), 'utf8'),
  );
  const first = manifest[0].componentName;
  const other = manifest[manifest.length - 1].componentName;

  const result = await build({
    stdin: {
      contents: `import { ${first} } from './dist/esm/index.js'; console.log(${first});`,
      resolveDir: REPO_ROOT,
    },
    bundle: true,
    format: 'esm',
    write: false,
    minify: false,
    external: ['react', 'react/jsx-runtime'],
  });

  const output = result.outputFiles[0].text;
  const kb = Math.round((output.length / 1024) * 10) / 10;
  console.log(`Bundle importing only ${first}: ${kb} KB`);
  if (output.length > 20 * 1024) {
    console.error(`FAIL: expected < 20 KB, got ${kb} KB — tree-shaking is broken.`);
    process.exit(1);
  }
  if (output.includes(other)) {
    console.error(`FAIL: bundle contains unrelated icon ${other}.`);
    process.exit(1);
  }
  console.log('Tree-shaking OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
