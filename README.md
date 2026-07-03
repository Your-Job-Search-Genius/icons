# @writesea/odyssey-icons

React icon library generated from the [Writesea Odyssey Figma file](https://www.figma.com/design/L1Tjy8S8lUAbQNQnvr4bJN/Writesea-Odyssey?node-id=68-195) (Huge Icon Set v2.0). Every icon ships in two variants: **stroke** (outline, the default name) and **solid** (filled, `Solid` suffix).

```tsx
import { AddCircleIcon, AddCircleSolidIcon } from '@writesea/odyssey-icons';

// Inherits the surrounding text color and renders at its Figma size (24px)
<AddCircleIcon />

// size: number = pixels, string = used verbatim
<AddCircleIcon size={32} />
<AddCircleIcon size="1em" />

// color: any CSS color; defaults to currentColor
<AddCircleSolidIcon color="#7C3AED" size={20} />

// All standard SVG props pass through, and refs reach the <svg> element
<AddCircleIcon className="mr-2" onClick={handleClick} ref={svgRef} />
```

Deep imports also work and keep bundles minimal (the barrel is tree-shakeable
either way thanks to `sideEffects: false`):

```tsx
import { AddCircleIcon } from '@writesea/odyssey-icons/icons/AddCircleIcon';
```

## Accessibility

Icons are `aria-hidden="true"` by default (decorative). Pass a `title` or
`aria-label` to make an icon meaningful — it then renders `role="img"` and a
`<title>` element so screen readers announce it:

```tsx
<TrashIcon title="Delete resume" />      // announced as "Delete resume"
<TrashIcon aria-label="Delete resume" /> // same, without a <title> element
<TrashIcon />                            // decorative, ignored by AT
```

## Multicolor icons

Most icons are monochrome and follow `color`/`currentColor`. A few use more
than one color, gradients, or embedded images; those keep their original
palette and are flagged with `"multicolor": true` in [`manifest.json`](./manifest.json),
which also maps every component back to its Figma layer name and node id.
Each component's `displayName` is its original Figma name (e.g. `"add-circle"`).

## Regenerating from Figma

```sh
# Requires a Figma personal access token with "File content: read" scope
# (figma.com -> Settings -> Security). Set it in the environment or in .env:
FIGMA_ACCESS_TOKEN=figd_...

npm run generate            # full regeneration (~7,300 icons, several minutes)
npm run generate -- --cache # reuse previously downloaded SVGs (fast re-runs)
npm run generate -- --limit 50   # small run for iterating on the generator
npm run generate -- --strict     # fail (not warn) if the page layout changed
```

Generation is idempotent — running it twice against an unchanged Figma file
produces no diff. `generation-report.json` records everything that was
skipped, renamed (name collisions get deterministic numeric suffixes), or
flagged multicolor.

## Building

```sh
npm run build   # dist/esm + dist/cjs + dist/types (.d.ts)
npm test        # vitest: a11y contract, factory props, manifest invariants
npm run verify:treeshake  # asserts a single-icon import stays tiny
```

> **License note:** the artwork originates from the commercial "Huge Icon Set
> v2.0". Confirm licensing before distributing this package outside Writesea.
