import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FILE_KEY = 'L1Tjy8S8lUAbQNQnvr4bJN';
export const CANVAS_NODE_ID = '68:195';
export const API_BASE = 'https://api.figma.com';
export const TOKEN_ENV_VAR = 'FIGMA_ACCESS_TOKEN';

/** Top-level frames on the icons page that are not icon categories. */
export const SKIP_TOP_LEVEL_FRAMES = new Set([
  'Colors',
  'Stroke',
  'Solid',
  'Usuage',
  'start_from_scratch',
  'Frame 3472487',
  'Frame 3472488',
]);

/** Instance names inside category frames that are annotations, not icons. */
export const SKIP_INSTANCE_NAMES = new Set(['Header', 'tag', 'Card']);

export const ICON_SIZE = 24;
export const ICON_SIZE_TOLERANCE = 0.5;
export const MAX_ICON_DIMENSION = 64;

/** Sanity check: the file currently has 57 category frames per variant. */
export const EXPECTED_CATEGORY_FRAMES_PER_VARIANT = 57;

/** Fallback stroke/solid y boundary when the giant "Stroke"/"Solid" label
 * frames cannot be found (verified: stroke categories end at y=7656, solid
 * categories start at y=15101). */
export const FALLBACK_SECTION_BOUNDARY_Y = 15000;

export type Variant = 'stroke' | 'solid';
export const VARIANT_NAME_SUFFIX: Record<Variant, string> = { stroke: '', solid: 'Solid' };

export const EXPORT_BATCH_SIZE = 100;
export const EXPORT_BATCH_DELAY_MS = 500;
export const EXPORT_MAX_ATTEMPTS = 6;
export const DOWNLOAD_CONCURRENCY = 16;
export const DOWNLOAD_TIMEOUT_MS = 30_000;

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(here, '..', '..');
export const SRC_DIR = join(REPO_ROOT, 'src');
export const ICONS_DIR = join(SRC_DIR, 'icons');
export const BARREL_PATH = join(SRC_DIR, 'index.ts');
export const MANIFEST_PATH = join(REPO_ROOT, 'manifest.json');
export const REPORT_PATH = join(REPO_ROOT, 'generation-report.json');
export const CACHE_DIR = join(REPO_ROOT, '.cache', 'svg');
export const ENV_FILE = join(REPO_ROOT, '.env');
