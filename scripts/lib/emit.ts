import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parse, type ElementNode, type ParsedNode } from 'svg-parser';

type IconNodeAttrs = Record<string, string | number | Record<string, string>>;
type IconNodeTuple = [string, IconNodeAttrs, IconNodeTuple[]?];

function isElement(node: ParsedNode | string): node is ElementNode {
  return typeof node === 'object' && node.type === 'element';
}

function upperFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function camelCase(s: string): string {
  const parts = s.split('-');
  return parts[0] + parts.slice(1).map(upperFirst).join('');
}

/** Map an SVG attribute name to its React prop name. */
export function reactAttrName(name: string): string {
  if (name === 'class') return 'className';
  if (name.startsWith('data-') || name.startsWith('aria-')) return name;
  if (name.startsWith('xlink:')) return `xlink${upperFirst(camelCase(name.slice(6)))}`;
  if (name.startsWith('xml:')) return `xml${upperFirst(camelCase(name.slice(4)))}`;
  if (name.includes('-')) return camelCase(name);
  return name;
}

function styleToObject(style: string): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const decl of style.split(';')) {
    const idx = decl.indexOf(':');
    if (idx <= 0) continue;
    const prop = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).trim();
    if (prop && value) obj[prop.startsWith('--') ? prop : camelCase(prop)] = value;
  }
  return obj;
}

function elementToTuple(el: ElementNode): IconNodeTuple {
  const attrs: IconNodeAttrs = {};
  for (const [key, value] of Object.entries(el.properties ?? {})) {
    if (key === 'style' && typeof value === 'string') {
      attrs.style = styleToObject(value);
    } else {
      attrs[reactAttrName(key)] = value;
    }
  }
  const children = el.children.filter(isElement).map(elementToTuple);
  return children.length > 0 ? [el.tagName ?? 'g', attrs, children] : [el.tagName ?? 'g', attrs];
}

export interface ParsedIconSvg {
  viewBox: string;
  nodes: IconNodeTuple[];
}

export function svgToIconNodes(optimizedSvg: string, nodeId: string): ParsedIconSvg {
  const root = parse(optimizedSvg);
  const svgEl = root.children.find(
    (c): c is ElementNode => isElement(c) && c.tagName === 'svg',
  );
  if (!svgEl) throw new Error(`No <svg> root element in export for node ${nodeId}`);
  const viewBox = String(svgEl.properties?.viewBox ?? '');
  if (!viewBox) throw new Error(`Export for node ${nodeId} has no viewBox`);
  return { viewBox, nodes: svgEl.children.filter(isElement).map(elementToTuple) };
}

const GENERATED_HEADER = '// GENERATED FILE - DO NOT EDIT. Run `npm run generate` to regenerate.';

export interface IconFileInput {
  componentName: string;
  figmaName: string;
  viewBox: string;
  width: number;
  height: number;
  nodes: IconNodeTuple[];
}

export function renderIconFile(icon: IconFileInput): string {
  const meta = JSON.stringify({
    name: icon.componentName,
    figmaName: icon.figmaName,
    viewBox: icon.viewBox,
    width: icon.width,
    height: icon.height,
  });
  const nodes = JSON.stringify(icon.nodes);
  return (
    `${GENERATED_HEADER}\n` +
    `import { createIcon } from '../createIcon.js';\n` +
    `\n` +
    `export const ${icon.componentName} = createIcon(${meta}, ${nodes});\n`
  );
}

export function renderBarrel(componentNames: string[]): string {
  const lines = [
    GENERATED_HEADER,
    `export type { IconComponent, IconMeta, IconNode, IconProps } from './types.js';`,
    `export { createIcon } from './createIcon.js';`,
    ...componentNames.map((n) => `export { ${n} } from './icons/${n}.js';`),
  ];
  return lines.join('\n') + '\n';
}

/** Write with LF endings and exactly one trailing newline; skip identical
 * content so re-runs leave mtimes (and diffs) untouched. */
export function writeFileDeterministic(path: string, content: string): boolean {
  let normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.endsWith('\n')) normalized += '\n';
  if (existsSync(path) && readFileSync(path, 'utf8') === normalized) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, normalized, 'utf8');
  return true;
}

export function resetDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}
