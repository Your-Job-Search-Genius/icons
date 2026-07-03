import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface ManifestEntry {
  componentName: string;
  figmaName: string;
  nodeId: string;
  componentId: string;
  width: number;
  height: number;
  variant: 'stroke' | 'solid';
  category: string;
  categories: string[];
  multicolor: boolean;
}

const root = join(__dirname, '..');
const manifestPath = join(root, 'manifest.json');
const hasManifest = existsSync(manifestPath);

describe.skipIf(!hasManifest)('generated library invariants', () => {
  const manifest: ManifestEntry[] = hasManifest
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : [];

  it('has at least one icon', () => {
    expect(manifest.length).toBeGreaterThan(0);
  });

  it('has unique component names (case-insensitive, for NTFS)', () => {
    const seen = new Set<string>();
    for (const entry of manifest) {
      const key = entry.componentName.toLowerCase();
      expect(seen.has(key), `duplicate component name: ${entry.componentName}`).toBe(false);
      seen.add(key);
    }
  });

  it('uses valid JS identifiers ending in Icon', () => {
    for (const entry of manifest) {
      expect(entry.componentName).toMatch(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
      expect(entry.componentName).toMatch(/Icon$/);
    }
  });

  it('has a source file for every manifest entry', () => {
    for (const entry of manifest) {
      const file = join(root, 'src', 'icons', `${entry.componentName}.ts`);
      expect(existsSync(file), `missing ${file}`).toBe(true);
    }
  });

  it('exports every icon from the barrel', () => {
    const barrel = readFileSync(join(root, 'src', 'index.ts'), 'utf8');
    for (const entry of manifest) {
      expect(barrel).toContain(`export { ${entry.componentName} }`);
    }
  });

  it('records original figma names and node ids', () => {
    for (const entry of manifest) {
      expect(entry.figmaName.length).toBeGreaterThan(0);
      expect(entry.nodeId).toMatch(/^\d+:\d+$/);
    }
  });
});
