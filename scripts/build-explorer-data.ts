import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ICONS_DIR, MANIFEST_PATH, REPO_ROOT } from './lib/config.js';

/**
 * Builds the data file consumed by the web icon explorer (`web/`).
 *
 * The searchable metadata (variant, categories, multicolor) lives in
 * manifest.json, but the SVG geometry lives only in the generated per-icon
 * files under src/icons. This merges both into a single JSON array so the
 * explorer can render and search every icon without importing ~7,300 modules.
 */

interface ManifestEntry {
  componentName: string;
  figmaName: string;
  variant: 'stroke' | 'solid';
  categories: string[];
  multicolor: boolean;
}

interface ExplorerIcon {
  name: string;
  figmaName: string;
  variant: 'stroke' | 'solid';
  categories: string[];
  multicolor: boolean;
  viewBox: string;
  nodes: unknown;
}

// The generated icon files are single-line: `... = createIcon(<meta>, <nodes>);`
// <meta> is a flat object (no nested braces); <nodes> is the trailing array.
const CREATE_ICON_RE = /createIcon\((\{[^{}]*\}),\s*(\[[\s\S]*\])\);/;

function main(): void {
  const manifest: ManifestEntry[] = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const byName = new Map(manifest.map((m) => [m.componentName, m]));

  const files = readdirSync(ICONS_DIR).filter((f) => f.endsWith('.ts'));
  const icons: ExplorerIcon[] = [];

  for (const file of files) {
    const name = file.replace(/\.ts$/, '');
    const meta = byName.get(name);
    if (!meta) throw new Error(`${name} has no manifest entry`);

    const source = readFileSync(join(ICONS_DIR, file), 'utf8');
    const match = source.match(CREATE_ICON_RE);
    if (!match) throw new Error(`Could not parse createIcon() args in ${file}`);

    const iconMeta = JSON.parse(match[1]) as { viewBox: string };
    const nodes = JSON.parse(match[2]);

    icons.push({
      name,
      figmaName: meta.figmaName,
      variant: meta.variant,
      categories: meta.categories,
      multicolor: meta.multicolor,
      viewBox: iconMeta.viewBox,
      nodes,
    });
  }

  icons.sort((a, b) => a.name.localeCompare(b.name));

  const outDir = join(REPO_ROOT, 'web', 'public');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'icons.json');
  writeFileSync(outPath, JSON.stringify(icons), 'utf8');
  console.log(`build:explorer-data OK — ${icons.length} icons -> ${outPath}`);
}

main();
