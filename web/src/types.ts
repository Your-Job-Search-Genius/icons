export type IconNode = [tag: string, attrs: Record<string, unknown>, children?: IconNode[]];

export interface ExplorerIcon {
  name: string;
  figmaName: string;
  variant: 'stroke' | 'solid';
  categories: string[];
  multicolor: boolean;
  viewBox: string;
  nodes: IconNode[];
}
