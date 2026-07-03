import type * as React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /**
   * Icon size, applied to both width and height. A number is treated as
   * pixels; a string is used verbatim ("1em", "24px", "100%"). Defaults to
   * the icon's original dimensions in Figma. Non-square icons keep their
   * aspect ratio.
   */
  size?: number | string;
  /**
   * Color applied via the SVG `color` property. Defaults to "currentColor"
   * so the icon inherits the surrounding text color. Multicolor icons keep
   * their own palette (see manifest.json, `multicolor: true`).
   */
  color?: string;
  /**
   * Accessible label rendered as a <title> element. When this (or
   * aria-label / aria-labelledby) is provided, the icon switches from
   * aria-hidden="true" to role="img" so it is announced by screen readers.
   */
  title?: string;
}

export type IconComponent = React.ForwardRefExoticComponent<
  IconProps & React.RefAttributes<SVGSVGElement>
>;

export interface IconMeta {
  /** PascalCase component name, e.g. "AddCircleIcon". */
  name: string;
  /** Original layer name in Figma, e.g. "add-circle". */
  figmaName: string;
  viewBox: string;
  width: number;
  height: number;
}

/** Serialized SVG element: [tagName, attributes, children?]. */
export type IconNode = [
  tag: string,
  attrs: Record<string, string | number | Record<string, string>>,
  children?: IconNode[],
];
