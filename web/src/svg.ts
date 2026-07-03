import type { ExplorerIcon, IconNode } from './types';

// React/JSX-style attribute names (as stored in the generated icon files) ->
// the kebab-case names a standalone SVG file needs. Anything not listed falls
// back to a generic camelCase->kebab conversion, which is correct for the
// stroke-*/fill-*/clip-* family used by these icons.
const CAMEL_TO_KEBAB = /([a-z0-9])([A-Z])/g;

function toSvgAttrName(name: string): string {
  if (name === 'className') return 'class';
  return name.replace(CAMEL_TO_KEBAB, '$1-$2').toLowerCase();
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function nodesToString(nodes: IconNode[]): string {
  return nodes
    .map(([tag, attrs, children]) => {
      const attrString = Object.entries(attrs as Record<string, unknown>)
        .map(([key, value]) => `${toSvgAttrName(key)}="${escapeAttr(String(value))}"`)
        .join(' ');
      const open = attrString ? `<${tag} ${attrString}` : `<${tag}`;
      if (children && children.length > 0) {
        return `${open}>${nodesToString(children)}</${tag}>`;
      }
      return `${open} />`;
    })
    .join('');
}

/**
 * Serializes an explorer icon to a standalone SVG string with the chosen color
 * and size baked in. For stroke/solid icons `currentColor` is resolved to the
 * picked color; multicolor icons keep their own palette.
 */
export function iconToSvgString(icon: ExplorerIcon, color: string, size: number): string {
  const body = nodesToString(icon.nodes);
  const resolved = icon.multicolor ? body : body.replace(/currentColor/g, color);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" ` +
    `width="${size}" height="${size}" fill="none">${resolved}</svg>`
  );
}
