import * as React from 'react';
import type { ExplorerIcon, IconNode } from './types';

function renderNodes(nodes: IconNode[]): React.ReactNode {
  return nodes.map(([tag, attrs, children], index) =>
    React.createElement(
      tag,
      { key: index, ...(attrs as Record<string, unknown>) },
      children && children.length > 0 ? renderNodes(children) : undefined,
    ),
  );
}

interface IconSvgProps {
  icon: ExplorerIcon;
  color: string;
  size: number | string;
}

/**
 * Renders an explorer icon exactly like the published component's createIcon
 * wrapper: the svg `color` prop drives currentColor for both stroke and solid
 * variants; multicolor icons keep their own palette.
 */
export function IconSvg({ icon, color, size }: IconSvgProps): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={icon.viewBox}
      width={size}
      height={size}
      color={color}
      fill="none"
      aria-hidden="true"
    >
      {renderNodes(icon.nodes)}
    </svg>
  );
}
