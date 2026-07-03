import { existsSync, readFileSync } from 'node:fs';
import {
  API_BASE,
  CANVAS_NODE_ID,
  DOWNLOAD_TIMEOUT_MS,
  ENV_FILE,
  EXPORT_MAX_ATTEMPTS,
  FILE_KEY,
  TOKEN_ENV_VAR,
} from './config.js';

export class FigmaApiError extends Error {}

const CONTEXT = `(file ${FILE_KEY}, node ${CANVAS_NODE_ID})`;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadDotEnvToken(): string | undefined {
  if (!existsSync(ENV_FILE)) return undefined;
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const match = /^\s*FIGMA_ACCESS_TOKEN\s*=\s*(.+?)\s*$/.exec(line);
    if (match && match[1]) return match[1].replace(/^["']|["']$/g, '');
  }
  return undefined;
}

let cachedToken: string | undefined;

export function getToken(): string {
  if (cachedToken) return cachedToken;
  const token = process.env[TOKEN_ENV_VAR] ?? loadDotEnvToken();
  if (!token) {
    console.error(
      `ERROR: ${TOKEN_ENV_VAR} is not set ${CONTEXT}.\n` +
        `Create a Figma personal access token with the "File content: read" scope\n` +
        `(figma.com -> Settings -> Security -> Personal access tokens) and either\n` +
        `set the ${TOKEN_ENV_VAR} environment variable or put it in ${ENV_FILE}.`,
    );
    process.exit(1);
  }
  cachedToken = token;
  return token;
}

async function figmaFetch<T>(path: string, what: string): Promise<T> {
  let lastError = '';
  for (let attempt = 1; attempt <= EXPORT_MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        headers: { 'X-Figma-Token': getToken() },
      });
    } catch (err) {
      lastError = `network error: ${String(err)}`;
      await sleep(Math.min(2000 * 2 ** attempt, 60_000));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const delay =
        retryAfter > 0
          ? retryAfter * 1000
          : Math.min(2000 * 2 ** attempt + Math.floor(Math.random() * 1000), 60_000);
      lastError = `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
      console.warn(
        `  Figma API ${res.status} on ${what}; retrying in ${Math.round(delay / 1000)}s ` +
          `(attempt ${attempt}/${EXPORT_MAX_ATTEMPTS})`,
      );
      await sleep(delay);
      continue;
    }
    if (!res.ok) {
      throw new FigmaApiError(
        `Figma API request failed ${CONTEXT}: ${what} -> HTTP ${res.status}: ` +
          `${(await res.text()).slice(0, 500)}`,
      );
    }
    return (await res.json()) as T;
  }
  throw new FigmaApiError(
    `Figma API request failed after ${EXPORT_MAX_ATTEMPTS} attempts ${CONTEXT}: ${what} -> ${lastError}`,
  );
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  componentId?: string;
  overrides?: Array<{ id: string; overriddenFields: string[] }>;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
}

export async function fetchCanvas(depth?: number): Promise<FigmaNode> {
  const depthParam = depth ? `&depth=${depth}` : '';
  const what = `GET /v1/files/${FILE_KEY}/nodes?ids=${CANVAS_NODE_ID}${depthParam}`;
  const json = await figmaFetch<{
    nodes: Record<string, { document: FigmaNode } | null>;
  }>(`/v1/files/${FILE_KEY}/nodes?ids=${encodeURIComponent(CANVAS_NODE_ID)}${depthParam}`, what);
  const entry = json.nodes?.[CANVAS_NODE_ID];
  if (!entry?.document) {
    throw new FigmaApiError(
      `Node ${CANVAS_NODE_ID} was not found in file ${FILE_KEY}. ` +
        `The icons page may have been moved or deleted. Response keys: ` +
        `${Object.keys(json.nodes ?? {}).join(', ') || '(none)'}`,
    );
  }
  return entry.document;
}

export async function exportSvgBatch(ids: string[]): Promise<Record<string, string | null>> {
  const query =
    `ids=${encodeURIComponent(ids.join(','))}` +
    `&format=svg&svg_include_id=false&svg_simplify_stroke=true&use_absolute_bounds=true`;
  const what = `GET /v1/images (${ids.length} ids: ${ids[0]}..${ids[ids.length - 1]})`;
  const json = await figmaFetch<{ err: string | null; images: Record<string, string | null> }>(
    `/v1/images/${FILE_KEY}?${query}`,
    what,
  );
  if (json.err) {
    throw new FigmaApiError(`Figma image export returned an error ${CONTEXT}: ${json.err}`);
  }
  return json.images;
}

export async function downloadSvg(url: string, nodeId: string): Promise<string> {
  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        if (res.status < 500) break;
        await sleep(1000 * attempt);
        continue;
      }
      const text = await res.text();
      const trimmed = text.trimStart();
      if (!trimmed.startsWith('<svg') && !trimmed.startsWith('<?xml')) {
        throw new FigmaApiError(
          `Downloaded export for node ${nodeId} is not SVG ${CONTEXT}. ` +
            `First bytes: ${text.slice(0, 200)}`,
        );
      }
      return text;
    } catch (err) {
      if (err instanceof FigmaApiError) throw err;
      lastError = String(err);
      await sleep(1000 * attempt);
    }
  }
  throw new FigmaApiError(
    `Failed to download SVG for node ${nodeId} ${CONTEXT}: ${lastError} (url: ${url.slice(0, 120)}...)`,
  );
}
