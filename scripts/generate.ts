import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BARREL_PATH,
  CACHE_DIR,
  CANVAS_NODE_ID,
  DOWNLOAD_CONCURRENCY,
  EXPECTED_CATEGORY_FRAMES_PER_VARIANT,
  EXPORT_BATCH_DELAY_MS,
  EXPORT_BATCH_SIZE,
  FILE_KEY,
  ICONS_DIR,
  MANIFEST_PATH,
  REPORT_PATH,
} from './lib/config.js';
import { downloadSvg, exportSvgBatch, fetchCanvas, getToken, sleep } from './lib/figma.js';
import {
  classify,
  collectCategories,
  compareNodeIds,
  dedupeByComponent,
  type ClassifyResult,
} from './lib/classify.js';
import { assignNames, type NamedIcon } from './lib/naming.js';
import { optimizeSvg, recolorSvg } from './lib/svg.js';
import {
  renderBarrel,
  renderIconFile,
  resetDir,
  svgToIconNodes,
  writeFileDeterministic,
} from './lib/emit.js';

interface Flags {
  limit: number | undefined;
  cache: boolean;
  strict: boolean;
  dryRun: boolean;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { limit: undefined, cache: false, strict: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--limit') flags.limit = Number(argv[++i]);
    else if (arg.startsWith('--limit=')) flags.limit = Number(arg.slice(8));
    else if (arg === '--cache') flags.cache = true;
    else if (arg === '--strict') flags.strict = true;
    else if (arg === '--dry-run') flags.dryRun = true;
    else {
      console.error(`Unknown flag: ${arg}`);
      process.exit(1);
    }
  }
  if (flags.limit !== undefined && (!Number.isInteger(flags.limit) || flags.limit <= 0)) {
    console.error('--limit must be a positive integer');
    process.exit(1);
  }
  return flags;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function cachePathFor(icon: NamedIcon): string {
  return join(CACHE_DIR, `${icon.variant}-${icon.nodeId.replace(/[:;]/g, '_')}.svg`);
}

async function fetchClassified(): Promise<ClassifyResult> {
  for (const depth of [2, 3, 4]) {
    console.log(`Fetching node tree (depth=${depth})...`);
    const canvas = await fetchCanvas(depth);
    const result = classify(canvas);
    console.log(`  found ${result.icons.length} icon instances at depth ${depth}`);
    if (result.icons.length >= 5000) return result;
    if (depth === 4) {
      console.warn('  fewer icons than expected even at depth 4; using this result');
      return result;
    }
    console.log('  fewer than expected; retrying one level deeper');
  }
  throw new Error('unreachable');
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const startedAt = Date.now();
  getToken(); // fail fast with a clear message if the token is missing

  // ---- 1. fetch + classify --------------------------------------------------
  const classified = await fetchClassified();
  const { icons: allInstances, skipped, textNodeCount, categoryFrames } = classified;

  if (allInstances.length === 0) {
    console.error(
      `ERROR: no icons were found under node ${CANVAS_NODE_ID} in file ${FILE_KEY}. ` +
        `Nothing was generated. Check that the node id still points at the icons page.`,
    );
    process.exit(1);
  }
  if (flags.strict) {
    for (const variant of ['stroke', 'solid'] as const) {
      if (categoryFrames[variant].length !== EXPECTED_CATEGORY_FRAMES_PER_VARIANT) {
        console.error(
          `ERROR (--strict): expected ${EXPECTED_CATEGORY_FRAMES_PER_VARIANT} ${variant} ` +
            `category frames, found ${categoryFrames[variant].length}.`,
        );
        process.exit(1);
      }
    }
  }

  // ---- 2. dedupe + name -----------------------------------------------------
  const categoriesByKey = collectCategories(allInstances);
  const { unique, duplicatesRemoved, keptOverrideDuplicates } = dedupeByComponent(allInstances);
  const { named, renames } = assignNames(unique);

  const trimmedNames = named
    .filter((i) => i.rawName !== i.figmaName)
    .map((i) => ({ nodeId: i.nodeId, from: i.rawName, to: i.figmaName }));

  console.log(
    `Classified ${allInstances.length} icon instances -> ${unique.length} unique icons ` +
      `(${duplicatesRemoved} duplicate placements removed, ` +
      `${keptOverrideDuplicates.length} override duplicates kept), ` +
      `${renames.length} name collisions renamed, ${skipped.length} nodes skipped, ` +
      `${textNodeCount} text labels ignored.`,
  );
  const strokeCount = named.filter((i) => i.variant === 'stroke').length;
  console.log(
    `Variants: ${strokeCount} stroke + ${named.length - strokeCount} solid across ` +
      `${categoryFrames.stroke.length}/${categoryFrames.solid.length} category frames.`,
  );

  const selected = flags.limit ? named.slice(0, flags.limit) : named;
  if (flags.limit) console.log(`--limit ${flags.limit}: generating first ${selected.length} icons only.`);

  // ---- 3. export + download -------------------------------------------------
  if (flags.cache) mkdirSync(CACHE_DIR, { recursive: true });
  const rawSvgByNodeId = new Map<string, string>();
  const needExport: NamedIcon[] = [];
  for (const icon of selected) {
    const cached = flags.cache && existsSync(cachePathFor(icon));
    if (cached) rawSvgByNodeId.set(icon.nodeId, readFileSync(cachePathFor(icon), 'utf8'));
    else needExport.push(icon);
  }
  if (rawSvgByNodeId.size > 0) console.log(`Cache: reusing ${rawSvgByNodeId.size} cached SVGs.`);

  const urlByNodeId = new Map<string, string>();
  const failedExports: NamedIcon[] = [];
  const batches: NamedIcon[][] = [];
  for (let i = 0; i < needExport.length; i += EXPORT_BATCH_SIZE) {
    batches.push(needExport.slice(i, i + EXPORT_BATCH_SIZE));
  }
  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const images = await exportSvgBatch(batch.map((i) => i.nodeId));
    let ok = 0;
    for (const icon of batch) {
      const url = images[icon.nodeId];
      if (url) {
        urlByNodeId.set(icon.nodeId, url);
        ok++;
      } else {
        failedExports.push(icon);
      }
    }
    console.log(`Export batch ${b + 1}/${batches.length}: ${ok}/${batch.length} rendered.`);
    if (b < batches.length - 1) await sleep(EXPORT_BATCH_DELAY_MS);
  }

  // Retry nodes Figma failed to render, in small batches.
  if (failedExports.length > 0) {
    console.warn(`Retrying ${failedExports.length} failed exports in batches of 10...`);
    const stillFailed: NamedIcon[] = [];
    for (let i = 0; i < failedExports.length; i += 10) {
      const batch = failedExports.slice(i, i + 10);
      await sleep(EXPORT_BATCH_DELAY_MS);
      const images = await exportSvgBatch(batch.map((n) => n.nodeId));
      for (const icon of batch) {
        const url = images[icon.nodeId];
        if (url) urlByNodeId.set(icon.nodeId, url);
        else stillFailed.push(icon);
      }
    }
    if (stillFailed.length > 0) {
      console.error(
        `ERROR: Figma could not render ${stillFailed.length} node(s) in file ${FILE_KEY} ` +
          `(under ${CANVAS_NODE_ID}). Nothing was written. Failed nodes:\n` +
          stillFailed.map((n) => `  ${n.nodeId}  ${n.figmaName} (${n.variant})`).join('\n'),
      );
      process.exit(1);
    }
  }

  const toDownload = needExport.filter((i) => urlByNodeId.has(i.nodeId));
  console.log(`Downloading ${toDownload.length} SVGs (concurrency ${DOWNLOAD_CONCURRENCY})...`);
  let downloaded = 0;
  await mapWithConcurrency(toDownload, DOWNLOAD_CONCURRENCY, async (icon) => {
    const svg = await downloadSvg(urlByNodeId.get(icon.nodeId)!, icon.nodeId);
    rawSvgByNodeId.set(icon.nodeId, svg);
    if (flags.cache) writeFileSync(cachePathFor(icon), svg, 'utf8');
    downloaded++;
    if (downloaded % 500 === 0) console.log(`  downloaded ${downloaded}/${toDownload.length}`);
  });

  // ---- 4. recolor + optimize + parse ---------------------------------------
  console.log('Optimizing and recoloring...');
  interface ProcessedIcon extends NamedIcon {
    viewBox: string;
    multicolor: boolean;
    colors: string[];
    fileContent: string;
  }
  const processed: ProcessedIcon[] = selected.map((icon) => {
    const raw = rawSvgByNodeId.get(icon.nodeId);
    if (!raw) throw new Error(`Internal error: no SVG for node ${icon.nodeId} (${icon.figmaName})`);
    const recolored = recolorSvg(raw);
    const optimized = optimizeSvg(recolored.svg, icon.nodeId);
    const { viewBox, nodes } = svgToIconNodes(optimized, icon.nodeId);
    return {
      ...icon,
      viewBox,
      multicolor: recolored.multicolor,
      colors: recolored.colors,
      fileContent: renderIconFile({
        componentName: icon.componentName,
        figmaName: icon.figmaName,
        viewBox,
        width: icon.width,
        height: icon.height,
        nodes,
      }),
    };
  });
  const multicolorIcons = processed.filter((i) => i.multicolor);

  // ---- 5. emit ----------------------------------------------------------------
  const manifest = processed.map((i) => ({
    componentName: i.componentName,
    figmaName: i.figmaName,
    nodeId: i.nodeId,
    componentId: i.componentId,
    width: i.width,
    height: i.height,
    variant: i.variant,
    category: i.category,
    categories:
      categoriesByKey.get(`${i.variant}|${i.componentId || `node:${i.nodeId}`}`) ?? [i.category],
    multicolor: i.multicolor,
  }));

  const report = {
    fileKey: FILE_KEY,
    canvasNodeId: CANVAS_NODE_ID,
    counts: {
      instancesSeen: allInstances.length,
      uniqueIcons: named.length,
      generated: processed.length,
      stroke: strokeCount,
      solid: named.length - strokeCount,
      duplicatePlacementsRemoved: duplicatesRemoved,
      textLabelsIgnored: textNodeCount,
      multicolor: multicolorIcons.length,
    },
    categoryFrames,
    renames,
    trimmedNames,
    keptOverrideDuplicates,
    multicolorIcons: multicolorIcons.map((i) => ({
      componentName: i.componentName,
      nodeId: i.nodeId,
      colors: i.colors,
    })),
    skipped: [...skipped].sort(
      (a, b) => compareNodeIds(a.nodeId, b.nodeId) || a.name.localeCompare(b.name, 'en'),
    ),
  };

  if (flags.dryRun) {
    console.log('--dry-run: skipping all writes.');
  } else {
    resetDir(ICONS_DIR);
    for (const icon of processed) {
      writeFileDeterministic(join(ICONS_DIR, `${icon.componentName}.ts`), icon.fileContent);
    }
    writeFileDeterministic(BARREL_PATH, renderBarrel(processed.map((i) => i.componentName)));
    writeFileDeterministic(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    writeFileDeterministic(REPORT_PATH, JSON.stringify(report, null, 2));
  }

  for (const rename of renames) {
    console.log(
      `RENAMED: "${rename.figmaName}" (${rename.nodeId}, ${rename.variant}) ` +
        `${rename.from} -> ${rename.to} (collision with ${rename.collidedWith})`,
    );
  }
  if (multicolorIcons.length > 0) {
    console.log(
      `Multicolor icons (${multicolorIcons.length}, colors preserved, flagged in manifest): ` +
        multicolorIcons.map((i) => i.componentName).join(', '),
    );
  }
  console.log(
    `Done: ${processed.length} icons emitted in ${Math.round((Date.now() - startedAt) / 1000)}s. ` +
      `Manifest: manifest.json, full log: generation-report.json`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
