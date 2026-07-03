import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createIcon } from '../src/createIcon.js';

const TestIcon = createIcon(
  { name: 'TestIcon', figmaName: 'test-icon', viewBox: '0 0 24 24', width: 24, height: 24 },
  [['path', { d: 'M2 2L22 22', stroke: 'currentColor' }]],
);

describe('accessibility', () => {
  it('is aria-hidden by default with no role', () => {
    const html = renderToStaticMarkup(<TestIcon />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role=');
    expect(html).not.toContain('<title');
  });

  it('switches to role="img" with a <title> when title is passed', () => {
    const html = renderToStaticMarkup(<TestIcon title="Close dialog" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('<title');
    expect(html).toContain('Close dialog');
    expect(html).toContain('aria-labelledby=');
    expect(html).not.toContain('aria-hidden');
  });

  it('switches to role="img" when aria-label is passed', () => {
    const html = renderToStaticMarkup(<TestIcon aria-label="Close" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Close"');
    expect(html).not.toContain('aria-hidden');
  });

  it('lets an explicit aria-hidden override win', () => {
    const html = renderToStaticMarkup(<TestIcon aria-hidden={false} />);
    expect(html).not.toContain('aria-hidden="true"');
  });
});
