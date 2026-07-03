import { describe, expect, it } from 'vitest';
import * as React from 'react';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { createIcon } from '../src/createIcon.js';

const SquareIcon = createIcon(
  { name: 'SquareIcon', figmaName: 'square-test', viewBox: '0 0 24 24', width: 24, height: 24 },
  [['path', { d: 'M2 2h20v20H2z', fill: 'currentColor' }]],
);

const WideIcon = createIcon(
  { name: 'WideIcon', figmaName: 'wide-test', viewBox: '0 0 48 24', width: 48, height: 24 },
  [['rect', { x: 0, y: 0, width: 48, height: 24, fill: 'currentColor' }]],
);

describe('createIcon factory', () => {
  it('defaults to the original Figma dimensions', () => {
    const html = renderToStaticMarkup(<SquareIcon />);
    expect(html).toContain('width="24"');
    expect(html).toContain('height="24"');
    expect(html).toContain('viewBox="0 0 24 24"');
  });

  it('applies numeric size to width and height', () => {
    const html = renderToStaticMarkup(<SquareIcon size={32} />);
    expect(html).toContain('width="32"');
    expect(html).toContain('height="32"');
  });

  it('passes string sizes through verbatim', () => {
    const html = renderToStaticMarkup(<SquareIcon size="1.5em" />);
    expect(html).toContain('width="1.5em"');
    expect(html).toContain('height="1.5em"');
  });

  it('preserves aspect ratio for non-square icons with numeric size', () => {
    const html = renderToStaticMarkup(<WideIcon size={96} />);
    expect(html).toContain('width="96"');
    expect(html).toContain('height="48"');
  });

  it('defaults color to currentColor and accepts overrides', () => {
    expect(renderToStaticMarkup(<SquareIcon />)).toContain('color="currentColor"');
    expect(renderToStaticMarkup(<SquareIcon color="#ff0000" />)).toContain('color="#ff0000"');
  });

  it('spreads arbitrary SVG props onto the root element', () => {
    const html = renderToStaticMarkup(
      <SquareIcon className="icon" data-testid="sq" strokeLinecap="round" />,
    );
    expect(html).toContain('class="icon"');
    expect(html).toContain('data-testid="sq"');
    expect(html).toContain('stroke-linecap="round"');
  });

  it('exposes the original Figma name as displayName', () => {
    expect(SquareIcon.displayName).toBe('square-test');
  });

  it('forwards the ref to the underlying <svg>', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const ref = React.createRef<SVGSVGElement>();
    React.act(() => {
      root.render(<SquareIcon ref={ref} />);
    });
    expect(ref.current).toBeInstanceOf(SVGSVGElement);
    React.act(() => root.unmount());
  });
});
