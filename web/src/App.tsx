import * as React from 'react';
import { IconSvg } from './IconSvg';
import { IconDetail } from './IconDetail';
import { VirtualGrid } from './VirtualGrid';
import type { ExplorerIcon } from './types';

const PKG = '@your-job-search-genius/icons';

type VariantFilter = 'all' | 'stroke' | 'solid';
export type PreviewBg = 'light' | 'dark' | 'checker';
type Theme = 'light' | 'dark';

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const SWATCHES = [
  'currentColor',
  '#7C3AED',
  '#2563EB',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#111827',
];

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('odyssey-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      className="copy-btn"
      data-copied={copied}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {copied ? 'Copied ✓' : label}
    </button>
  );
}

export function App(): React.ReactElement {
  const [icons, setIcons] = React.useState<ExplorerIcon[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [theme, setTheme] = React.useState<Theme>(getInitialTheme);
  const [query, setQuery] = React.useState('');
  const [variant, setVariant] = React.useState<VariantFilter>('all');
  const [category, setCategory] = React.useState('all');
  const [color, setColor] = React.useState('#7C3AED');
  const [size, setSize] = React.useState(28);
  const [bg, setBg] = React.useState<PreviewBg>('light');
  const [selected, setSelected] = React.useState<ExplorerIcon | null>(null);

  const searchRef = React.useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounced(query, 150);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('odyssey-theme', theme);
  }, [theme]);

  React.useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}icons.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load icons.json (${r.status})`);
        return r.json();
      })
      .then((data: ExplorerIcon[]) => setIcons(data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const categories = React.useMemo(() => {
    if (!icons) return [];
    const set = new Set<string>();
    for (const icon of icons) for (const c of icon.categories) set.add(c);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [icons]);

  const filtered = React.useMemo(() => {
    if (!icons) return [];
    const q = debouncedQuery.trim().toLowerCase();
    return icons.filter((icon) => {
      if (variant !== 'all' && icon.variant !== variant) return false;
      if (category !== 'all' && !icon.categories.includes(category)) return false;
      if (!q) return true;
      return (
        icon.name.toLowerCase().includes(q) ||
        icon.figmaName.toLowerCase().includes(q) ||
        icon.categories.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [icons, debouncedQuery, variant, category]);

  const cellWidth = Math.max(size + 44, 108);
  const cellHeight = cellWidth + 22;
  const swatchColor = HEX_RE.test(color) ? color : '#000000';

  return (
    <div className="app" data-bg={bg}>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" style={{ color: '#7C3AED' }} aria-hidden="true">
            {icons && icons[0] && <IconSvg icon={icons[0]} color="#7C3AED" size={22} />}
          </span>
          <div>
            <h1>Odyssey Icons</h1>
            <code className="pkg">{PKG}</code>
          </div>
        </div>

        <div className="header-actions">
          <div className="install">
            <code>npm i {PKG}</code>
            <CopyButton text={`npm install ${PKG}`} />
          </div>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>
      </header>

      <div className="toolbar">
        <div className="search-wrap">
          <input
            ref={searchRef}
            className="search"
            type="search"
            placeholder="Search icons by name or category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="search-hint">/</kbd>
        </div>

        <div className="segmented" role="group" aria-label="Variant">
          {(['all', 'stroke', 'solid'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={variant === v ? 'is-active' : ''}
              onClick={() => setVariant(v)}
            >
              {v === 'all' ? 'All' : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <div className="field color-field">
          <span>Color</span>
          <div className="color-control">
            <div className="swatches">
              {SWATCHES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`swatch${color === s ? ' is-active' : ''}${s === 'currentColor' ? ' swatch-current' : ''}`}
                  style={s === 'currentColor' ? undefined : { background: s }}
                  onClick={() => setColor(s)}
                  title={s}
                  aria-label={`Set color ${s}`}
                >
                  {s === 'currentColor' ? 'A' : ''}
                </button>
              ))}
            </div>
            <span className="color-input">
              <input
                type="color"
                value={swatchColor}
                onChange={(e) => setColor(e.target.value)}
                aria-label="Custom color"
              />
              <input
                className="color-text"
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                spellCheck={false}
                aria-label="Color hex value"
              />
            </span>
          </div>
        </div>

        <label className="field">
          <span>Size · {size}px</span>
          <input
            type="range"
            min={16}
            max={64}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
        </label>

        <div className="segmented bg-toggle" role="group" aria-label="Preview background">
          {(['light', 'dark', 'checker'] as const).map((b) => (
            <button
              key={b}
              type="button"
              className={bg === b ? 'is-active' : ''}
              onClick={() => setBg(b)}
              title={`${b} background`}
            >
              {b === 'light' ? '◻' : b === 'dark' ? '◼' : '▦'}
            </button>
          ))}
        </div>

        <p className="count">
          {icons
            ? `${filtered.length.toLocaleString()} / ${icons.length.toLocaleString()}`
            : ''}
        </p>
      </div>

      <main className="content">
        {error && <div className="status error">Error: {error}</div>}
        {!icons && !error && <div className="status">Loading icons…</div>}
        {icons && filtered.length === 0 && (
          <div className="status">No icons match your filters.</div>
        )}
        {icons && filtered.length > 0 && (
          <VirtualGrid
            items={filtered}
            cellWidth={cellWidth}
            cellHeight={cellHeight}
            renderCell={(icon) => (
              <button
                type="button"
                className={`icon-cell${selected?.name === icon.name ? ' is-selected' : ''}`}
                onClick={() => setSelected(icon)}
                title={icon.name}
              >
                <span className="icon-glyph">
                  <IconSvg icon={icon} color={color} size={size} />
                </span>
                <span className="icon-name">{icon.name.replace(/Icon$/, '')}</span>
              </button>
            )}
          />
        )}
      </main>

      {selected && (
        <IconDetail
          icon={selected}
          color={color}
          size={size}
          bg={bg}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
