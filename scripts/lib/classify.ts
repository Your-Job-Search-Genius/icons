import {
  EXPECTED_CATEGORY_FRAMES_PER_VARIANT,
  FALLBACK_SECTION_BOUNDARY_Y,
  ICON_SIZE,
  ICON_SIZE_TOLERANCE,
  MAX_ICON_DIMENSION,
  SKIP_INSTANCE_NAMES,
  SKIP_TOP_LEVEL_FRAMES,
  type Variant,
} from './config.js';
import type { FigmaNode } from './figma.js';

export interface IconInstance {
  nodeId: string;
  /** Trimmed Figma layer name. */
  figmaName: string;
  rawName: string;
  componentId: string;
  hasOverrides: boolean;
  width: number;
  height: number;
  variant: Variant;
  category: string;
}

export interface SkippedNode {
  nodeId: string;
  name: string;
  reason: string;
}

export interface ClassifyResult {
  icons: IconInstance[];
  skipped: SkippedNode[];
  textNodeCount: number;
  categoryFrames: Record<Variant, string[]>;
  boundaryY: number;
  usedFallbackBoundary: boolean;
  maxDepthSeen: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const CONTAINER_TYPES = new Set(['FRAME', 'GROUP', 'SECTION']);

export function classify(canvas: FigmaNode): ClassifyResult {
  const topFrames = canvas.children ?? [];
  const skipped: SkippedNode[] = [];
  const icons: IconInstance[] = [];
  let textNodeCount = 0;
  let maxDepthSeen = 0;

  // Section boundary: midpoint between the giant "Stroke" and "Solid" label
  // frames. Everything below the midpoint is the solid section.
  const strokeLabel = topFrames.find((f) => f.name.trim() === 'Stroke' && f.type === 'FRAME');
  const solidLabel = topFrames.find((f) => f.name.trim() === 'Solid' && f.type === 'FRAME');
  let boundaryY = FALLBACK_SECTION_BOUNDARY_Y;
  let usedFallbackBoundary = true;
  if (strokeLabel?.absoluteBoundingBox && solidLabel?.absoluteBoundingBox) {
    boundaryY = (strokeLabel.absoluteBoundingBox.y + solidLabel.absoluteBoundingBox.y) / 2;
    usedFallbackBoundary = false;
  } else {
    console.warn(
      `WARNING: could not find the "Stroke"/"Solid" label frames; falling back to ` +
        `y >= ${FALLBACK_SECTION_BOUNDARY_Y} as the section boundary.`,
    );
  }

  const categoryFrames: Record<Variant, string[]> = { stroke: [], solid: [] };

  for (const frame of topFrames) {
    const frameName = frame.name.trim();
    if (SKIP_TOP_LEVEL_FRAMES.has(frameName)) {
      skipped.push({ nodeId: frame.id, name: frameName, reason: 'skip-frame' });
      continue;
    }
    if (frame.type === 'TEXT') {
      textNodeCount++;
      continue;
    }
    if (!CONTAINER_TYPES.has(frame.type)) {
      skipped.push({ nodeId: frame.id, name: frameName, reason: `top-level-${frame.type}` });
      continue;
    }

    const frameY = frame.absoluteBoundingBox?.y ?? 0;
    const variant: Variant = frameY >= boundaryY ? 'solid' : 'stroke';
    let iconsInFrame = 0;

    const walk = (node: FigmaNode, depth: number): void => {
      maxDepthSeen = Math.max(maxDepthSeen, depth);
      for (const child of node.children ?? []) {
        if (child.type === 'TEXT') {
          textNodeCount++;
          continue;
        }
        if (child.type === 'INSTANCE') {
          const name = child.name.trim();
          const box = child.absoluteBoundingBox;
          const w = round2(box?.width ?? 0);
          const h = round2(box?.height ?? 0);
          if (SKIP_INSTANCE_NAMES.has(name)) {
            skipped.push({ nodeId: child.id, name, reason: 'skip-instance-name' });
          } else if (w > MAX_ICON_DIMENSION || h > MAX_ICON_DIMENSION) {
            skipped.push({ nodeId: child.id, name, reason: `oversized (${w}x${h})` });
          } else if (
            Math.abs(w - ICON_SIZE) <= ICON_SIZE_TOLERANCE &&
            Math.abs(h - ICON_SIZE) <= ICON_SIZE_TOLERANCE
          ) {
            icons.push({
              nodeId: child.id,
              figmaName: name,
              rawName: child.name,
              componentId: child.componentId ?? '',
              hasOverrides: (child.overrides ?? []).length > 0,
              width: round2(w) === ICON_SIZE ? ICON_SIZE : w,
              height: round2(h) === ICON_SIZE ? ICON_SIZE : h,
              variant,
              category: frameName,
            });
            iconsInFrame++;
          } else {
            skipped.push({ nodeId: child.id, name, reason: `unexpected-size (${w}x${h})` });
          }
          // Never traverse into instances: their children are component internals.
          continue;
        }
        if (CONTAINER_TYPES.has(child.type)) {
          walk(child, depth + 1);
        }
        // Other node types (RECTANGLE, VECTOR, ...) inside category frames are
        // decoration; counted implicitly by not being icons.
      }
    };
    walk(frame, 1);

    if (iconsInFrame > 0) categoryFrames[variant].push(frameName);
  }

  for (const variant of ['stroke', 'solid'] as const) {
    const count = categoryFrames[variant].length;
    if (count !== EXPECTED_CATEGORY_FRAMES_PER_VARIANT) {
      console.warn(
        `WARNING: expected ${EXPECTED_CATEGORY_FRAMES_PER_VARIANT} ${variant} category frames, ` +
          `found ${count}. The Figma layout may have changed; review the section boundary.`,
      );
    }
  }

  return { icons, skipped, textNodeCount, categoryFrames, boundaryY, usedFallbackBoundary, maxDepthSeen };
}

function nodeIdParts(id: string): number[] {
  return id.split(/[:;]/).map((p) => Number(p) || 0);
}

export function compareNodeIds(a: string, b: string): number {
  const pa = nodeIdParts(a);
  const pb = nodeIdParts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return a.localeCompare(b, 'en');
}

export interface DedupeResult {
  unique: IconInstance[];
  duplicatesRemoved: number;
  keptOverrideDuplicates: SkippedNode[];
}

/**
 * Same component placed on several category sheets = one icon. Instances with
 * overrides are kept as distinct icons (their artwork may differ) and logged.
 */
export function dedupeByComponent(icons: IconInstance[]): DedupeResult {
  const byKey = new Map<string, IconInstance[]>();
  const keptOverrideDuplicates: SkippedNode[] = [];
  const unique: IconInstance[] = [];
  let duplicatesRemoved = 0;

  for (const icon of icons) {
    const key = icon.componentId
      ? `${icon.variant}|${icon.componentId}`
      : `${icon.variant}|node:${icon.nodeId}`;
    const group = byKey.get(key);
    if (group) group.push(icon);
    else byKey.set(key, [icon]);
  }

  const sortedKeys = [...byKey.keys()].sort((a, b) => a.localeCompare(b, 'en'));
  for (const key of sortedKeys) {
    const group = byKey.get(key)!.sort((a, b) => compareNodeIds(a.nodeId, b.nodeId));
    const canonical = group.find((g) => !g.hasOverrides) ?? group[0];
    unique.push(canonical);
    for (const other of group) {
      if (other === canonical) continue;
      if (other.hasOverrides) {
        unique.push(other);
        keptOverrideDuplicates.push({
          nodeId: other.nodeId,
          name: other.figmaName,
          reason: `kept as distinct icon: instance of ${other.componentId} with overrides`,
        });
      } else {
        duplicatesRemoved++;
      }
    }
  }

  return { unique, duplicatesRemoved, keptOverrideDuplicates };
}

/** All categories each deduped icon appears in, for the manifest. */
export function collectCategories(all: IconInstance[]): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const icon of all) {
    const key = `${icon.variant}|${icon.componentId || `node:${icon.nodeId}`}`;
    let set = map.get(key);
    if (!set) map.set(key, (set = new Set()));
    set.add(icon.category);
  }
  const result = new Map<string, string[]>();
  for (const [key, set] of map) {
    result.set(key, [...set].sort((a, b) => a.localeCompare(b, 'en')));
  }
  return result;
}
