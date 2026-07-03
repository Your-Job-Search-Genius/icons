import { VARIANT_NAME_SUFFIX, type Variant } from './config.js';
import { compareNodeIds, type IconInstance } from './classify.js';

export function pascalCase(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function componentNameFor(figmaName: string, variant: Variant): string {
  let base = pascalCase(figmaName.trim());
  if (base === '') base = 'Unnamed';
  if (/^\d/.test(base)) base = `Icon${base}`;
  return `${base}${VARIANT_NAME_SUFFIX[variant]}Icon`;
}

export interface NamedIcon extends IconInstance {
  componentName: string;
}

export interface Rename {
  nodeId: string;
  figmaName: string;
  variant: Variant;
  from: string;
  to: string;
  collidedWith: string;
}

export interface NamingResult {
  named: NamedIcon[];
  renames: Rename[];
}

/**
 * Assign component names; collisions (same final name from different icons)
 * are resolved deterministically: colliders sorted by node id, the first
 * keeps the name, the rest get a numeric suffix before "Icon". Uniqueness is
 * enforced case-insensitively because generated filenames land on NTFS.
 */
export function assignNames(icons: IconInstance[]): NamingResult {
  const groups = new Map<string, IconInstance[]>();
  for (const icon of icons) {
    const name = componentNameFor(icon.figmaName, icon.variant);
    const key = name.toLowerCase();
    const group = groups.get(key);
    if (group) group.push(icon);
    else groups.set(key, [icon]);
  }

  const taken = new Set<string>(groups.keys());
  const named: NamedIcon[] = [];
  const renames: Rename[] = [];

  const sortedKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'en'));
  for (const key of sortedKeys) {
    const group = groups.get(key)!.sort((a, b) => compareNodeIds(a.nodeId, b.nodeId));
    const baseName = componentNameFor(group[0].figmaName, group[0].variant);
    named.push({ ...group[0], componentName: baseName });
    let suffix = 2;
    for (const icon of group.slice(1)) {
      let candidate: string;
      do {
        candidate = baseName.replace(/Icon$/, `${suffix}Icon`);
        suffix++;
      } while (taken.has(candidate.toLowerCase()));
      taken.add(candidate.toLowerCase());
      named.push({ ...icon, componentName: candidate });
      renames.push({
        nodeId: icon.nodeId,
        figmaName: icon.figmaName,
        variant: icon.variant,
        from: baseName,
        to: candidate,
        collidedWith: group[0].nodeId,
      });
    }
  }

  named.sort((a, b) => a.componentName.localeCompare(b.componentName, 'en'));
  return { named, renames };
}
