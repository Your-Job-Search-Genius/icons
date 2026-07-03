import * as React from 'react';
import type { IconComponent, IconMeta, IconNode, IconProps } from './types.js';

function renderNodes(nodes: IconNode[]): React.ReactNode {
  return nodes.map(([tag, attrs, children], index) =>
    React.createElement(
      tag,
      { key: index, ...attrs },
      children && children.length > 0 ? renderNodes(children) : undefined,
    ),
  );
}

export function createIcon(meta: IconMeta, nodes: IconNode[]): IconComponent {
  const Icon = React.forwardRef<SVGSVGElement, IconProps>(function IconRender(props, ref) {
    const {
      size,
      color = 'currentColor',
      title,
      width,
      height,
      children,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-hidden': ariaHidden,
      ...rest
    } = props;

    const autoTitleId = React.useId();
    const labelled = title != null || ariaLabel != null || ariaLabelledBy != null;

    const ratio = meta.width > 0 ? meta.height / meta.width : 1;
    let sizeWidth: number | string | undefined;
    let sizeHeight: number | string | undefined;
    if (typeof size === 'number') {
      sizeWidth = size;
      sizeHeight = ratio === 1 ? size : Math.round(size * ratio * 1000) / 1000;
    } else if (typeof size === 'string') {
      sizeWidth = size;
      // For non-square icons a string size only sets the width; the height is
      // left off so the browser derives it from the viewBox aspect ratio.
      sizeHeight = ratio === 1 ? size : undefined;
    }

    const finalWidth = width ?? sizeWidth ?? meta.width;
    let finalHeight = height ?? sizeHeight;
    if (finalHeight === undefined && !(typeof size === 'string' && ratio !== 1)) {
      finalHeight = meta.height;
    }

    const a11yProps: React.SVGProps<SVGSVGElement> = labelled
      ? {
          role: 'img',
          'aria-label': ariaLabel,
          'aria-labelledby':
            ariaLabelledBy ?? (title != null && ariaLabel == null ? autoTitleId : undefined),
          'aria-hidden': ariaHidden,
        }
      : { 'aria-hidden': ariaHidden ?? true };

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={meta.viewBox}
        width={finalWidth}
        height={finalHeight}
        color={color}
        fill="none"
        {...a11yProps}
        {...rest}
      >
        {title != null ? (
          <title id={ariaLabelledBy == null && ariaLabel == null ? autoTitleId : undefined}>
            {title}
          </title>
        ) : null}
        {renderNodes(nodes)}
        {children}
      </svg>
    );
  });

  // Per spec: the original Figma layer name is attached as displayName (and in
  // manifest.json) so every icon traces back to its source in Figma.
  Icon.displayName = meta.figmaName;
  return Icon as IconComponent;
}
