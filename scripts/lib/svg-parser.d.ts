declare module 'svg-parser' {
  export interface ElementNode {
    type: 'element';
    tagName?: string;
    properties?: Record<string, string | number>;
    children: Array<ParsedNode | string>;
    value?: string;
  }
  export interface TextNode {
    type: 'text';
    value?: string | boolean | number;
  }
  export interface RootNode {
    type: 'root';
    children: ParsedNode[];
  }
  export type ParsedNode = RootNode | ElementNode | TextNode;
  export function parse(source: string): RootNode;
}
