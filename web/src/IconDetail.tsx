import * as React from 'react';
import { IconSvg } from './IconSvg';
import { iconToSvgString } from './svg';
import type { ExplorerIcon } from './types';
import type { PreviewBg } from './App';

const PKG = '@your-job-search-genius/icons';

interface IconDetailProps {
  icon: ExplorerIcon;
  color: string;
  size: number;
  bg: PreviewBg;
  onClose: () => void;
}

type Tab = 'usage' | 'import' | 'install';

function CodeBlock({ code }: { code: string }): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="code-block">
      <pre>
        <code>{code}</code>
      </pre>
      <button
        type="button"
        className="copy-btn code-copy"
        data-copied={copied}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          } catch {
            /* clipboard unavailable */
          }
        }}
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  );
}

export function IconDetail({ icon, color, size, bg, onClose }: IconDetailProps): React.ReactElement {
  const [tab, setTab] = React.useState<Tab>('usage');
  const previewSize = Math.min(Math.max(size, 32), 112);

  const colorProp = color.toLowerCase() === 'currentcolor' ? '' : ` color="${color}"`;
  const usageCode = `import { ${icon.name} } from '${PKG}';\n\n<${icon.name}${colorProp} size={${size}} />`;
  const importCode = `import { ${icon.name} } from '${PKG}/${icon.name}';`;
  const installCode = `npm install ${PKG}`;
  const codeByTab: Record<Tab, string> = {
    usage: usageCode,
    import: importCode,
    install: installCode,
  };

  const downloadSvg = () => {
    const svg = iconToSvgString(icon, color, size);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${icon.name}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copySvg = async () => {
    try {
      await navigator.clipboard.writeText(iconToSvgString(icon, color, size));
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <>
      <div className="detail-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="detail" aria-label={`Details for ${icon.name}`}>
        <div className="detail-top">
          <div>
            <h2>{icon.name}</h2>
            <span className={`badge badge-${icon.variant}`}>{icon.variant}</span>
          </div>
          <button type="button" className="close" onClick={onClose} aria-label="Close details">
            ×
          </button>
        </div>

        <div className="detail-preview" data-bg={bg} style={{ color }}>
          <IconSvg icon={icon} color={color} size={previewSize} />
        </div>

        <div className="detail-svg-actions">
          <button type="button" onClick={copySvg}>
            Copy SVG
          </button>
          <button type="button" onClick={downloadSvg}>
            Download SVG
          </button>
        </div>

        <dl className="meta">
          <div>
            <dt>Figma name</dt>
            <dd>{icon.figmaName}</dd>
          </div>
          <div>
            <dt>Categories</dt>
            <dd>
              {icon.categories.length > 0
                ? icon.categories.map((c) => (
                    <span key={c} className="chip">
                      {c}
                    </span>
                  ))
                : '—'}
            </dd>
          </div>
          {icon.multicolor && (
            <div>
              <dt>Note</dt>
              <dd>multicolor — keeps its own palette</dd>
            </div>
          )}
        </dl>

        <div className="tabs" role="tablist" aria-label="Code examples">
          {(['usage', 'import', 'install'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? 'is-active' : ''}
              onClick={() => setTab(t)}
            >
              {t === 'usage' ? 'Usage' : t === 'import' ? 'Deep import' : 'Install'}
            </button>
          ))}
        </div>

        <CodeBlock code={codeByTab[tab]} />
      </aside>
    </>
  );
}
