import { parse, type ElementNode, type ParsedNode, type RootNode } from 'svg-parser';
import { optimize, type Config as SvgoConfig } from 'svgo';

const SHAPE_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const MULTICOLOR_ELEMENT_TAGS = new Set(['linearGradient', 'radialGradient', 'pattern', 'image']);

const NAMED_COLORS: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  gray: '#808080',
  grey: '#808080',
};

/** Normalize a paint value for comparison; alpha is ignored so the same hue
 * at two opacities still counts as monochrome. */
export function normalizeColor(value: string): string {
  let v = value.trim().toLowerCase();
  if (v in NAMED_COLORS) v = NAMED_COLORS[v];
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v);
  if (rgb) {
    const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
    return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`;
  }
  if (/^#[0-9a-f]{3,4}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  if (/^#[0-9a-f]{8}$/.test(v)) return v.slice(0, 7);
  return v;
}

function isElement(node: ParsedNode | string): node is ElementNode {
  return typeof node === 'object' && node.type === 'element';
}

function styleDeclarations(style: string): Array<[string, string]> {
  return style
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const idx = d.indexOf(':');
      return [d.slice(0, idx).trim().toLowerCase(), d.slice(idx + 1).trim()] as [string, string];
    })
    .filter(([prop]) => prop.length > 0);
}

function paintOf(el: ElementNode, prop: 'fill' | 'stroke'): string | undefined {
  const attr = el.properties?.[prop];
  if (attr !== undefined) return String(attr);
  const style = el.properties?.style;
  if (typeof style === 'string') {
    for (const [p, v] of styleDeclarations(style)) {
      if (p === prop) return v;
    }
  }
  return undefined;
}

export interface RecolorResult {
  svg: string;
  multicolor: boolean;
  colors: string[];
}

/**
 * Census all solid paints in the SVG (tracking inheritance — Figma exports
 * set fill="none" on the root, and stroke paths carry no fill attribute).
 * Monochrome icons get every non-"none" paint replaced with currentColor;
 * multicolor icons (>1 color, gradients, patterns, embedded images) are left
 * untouched. fill="none"/stroke="none" are never modified.
 */
export function recolorSvg(rawSvg: string): RecolorResult {
  const root = parse(rawSvg);
  const colors = new Set<string>();
  let hasGradientOrImage = false;

  // Paints inside clipPath/mask are not part of the visible palette: clip
  // paths use geometry only, and mask fills encode alpha. Skip them in the
  // census and never rewrite them.
  const INERT_TAGS = new Set(['clipPath', 'mask']);

  const census = (
    node: ParsedNode | string,
    inheritedFill: string | undefined,
    inheritedStroke: string | undefined,
  ): void => {
    if (!isElement(node)) return;
    const tag = node.tagName ?? '';
    if (INERT_TAGS.has(tag)) return;
    if (MULTICOLOR_ELEMENT_TAGS.has(tag)) hasGradientOrImage = true;

    const ownFill = paintOf(node, 'fill');
    const ownStroke = paintOf(node, 'stroke');
    const fill = ownFill ?? inheritedFill;
    const stroke = ownStroke ?? inheritedStroke;

    if (SHAPE_TAGS.has(tag) || tag === 'text' || tag === 'tspan') {
      // SVG default fill is black; default stroke is none.
      const effFill = fill ?? '#000000';
      const effStroke = stroke ?? 'none';
      for (const paint of [effFill, effStroke]) {
        const v = paint.trim().toLowerCase();
        if (v === 'none' || v === 'transparent' || v === '') continue;
        if (v.startsWith('url(')) {
          hasGradientOrImage = true;
          continue;
        }
        if (v === 'currentcolor') continue;
        colors.add(normalizeColor(v));
      }
    }

    for (const child of node.children) census(child, fill, stroke);
  };
  for (const child of root.children) census(child, undefined, undefined);

  const multicolor = hasGradientOrImage || colors.size > 1;

  if (!multicolor) {
    const rewrite = (node: ParsedNode | string, inheritedFill: string | undefined): void => {
      if (!isElement(node)) return;
      if (INERT_TAGS.has(node.tagName ?? '')) return;
      const props = (node.properties ??= {});
      const ownFill = paintOf(node, 'fill');

      for (const prop of ['fill', 'stroke'] as const) {
        const attr = props[prop];
        if (attr !== undefined && String(attr).trim().toLowerCase() !== 'none') {
          props[prop] = 'currentColor';
        }
      }
      if (typeof props.style === 'string') {
        props.style = styleDeclarations(props.style)
          .map(([p, v]) =>
            (p === 'fill' || p === 'stroke') && v.trim().toLowerCase() !== 'none'
              ? `${p}:currentColor`
              : `${p}:${v}`,
          )
          .join(';');
      }
      // A shape with no fill anywhere in scope renders implicit black — make
      // the paint explicit so it follows currentColor instead.
      const tag = node.tagName ?? '';
      if (SHAPE_TAGS.has(tag) && ownFill === undefined && inheritedFill === undefined) {
        props.fill = 'currentColor';
      }

      const nextFill = paintOf(node, 'fill') ?? inheritedFill;
      for (const child of node.children) rewrite(child, nextFill);
    };
    for (const child of root.children) rewrite(child, undefined);
  }

  return {
    svg: serialize(root),
    multicolor,
    colors: [...colors].sort((a, b) => a.localeCompare(b, 'en')),
  };
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function serializeNode(node: ParsedNode | string): string {
  if (typeof node === 'string') return escapeAttr(node);
  if (node.type === 'text') return node.value === undefined ? '' : escapeAttr(String(node.value));
  if (node.type === 'root') return node.children.map(serializeNode).join('');
  const tag = node.tagName ?? 'g';
  const attrs = Object.entries(node.properties ?? {})
    .map(([k, v]) => ` ${k}="${escapeAttr(String(v))}"`)
    .join('');
  const inner = node.children.map(serializeNode).join('');
  return inner ? `<${tag}${attrs}>${inner}</${tag}>` : `<${tag}${attrs}/>`;
}

export function serialize(root: RootNode): string {
  return root.children.map(serializeNode).join('');
}

const SVGO_CONFIG: SvgoConfig = {
  multipass: true,
  js2svg: { pretty: false, eol: 'lf', finalNewline: false },
  plugins: [
    'convertStyleToAttrs',
    {
      name: 'preset-default',
      params: {
        overrides: {
          // The viewBox is the sizing contract — never remove it.
          removeViewBox: false,
          // Merging sibling paths changes rendering with fill-rule knockouts
          // and partial opacity; icons must render pixel-identical.
          mergePaths: false,
          // Could delete the fill/stroke attributes carrying currentColor.
          removeUselessStrokeAndFill: false,
          removeUnknownsAndDefaults: { defaultAttrs: false },
          convertShapeToPath: false,
          convertPathData: { floatPrecision: 3, transformPrecision: 5 },
        },
      },
    },
    'removeDimensions',
    'sortAttrs',
  ],
};

export function optimizeSvg(svg: string, nodeId: string): string {
  const result = optimize(svg, SVGO_CONFIG);
  if (!result.data) {
    throw new Error(`SVGO produced empty output for node ${nodeId}`);
  }
  return result.data;
}
