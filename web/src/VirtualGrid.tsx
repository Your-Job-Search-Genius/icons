import * as React from 'react';

interface VirtualGridProps<T> {
  items: T[];
  cellWidth: number;
  cellHeight: number;
  overscanRows?: number;
  renderCell: (item: T, index: number) => React.ReactNode;
}

/**
 * Minimal windowed grid: only the rows intersecting the viewport (plus a small
 * overscan) are mounted, so all ~7,300 icons can be scrolled without mounting
 * thousands of SVGs at once. No external dependency.
 */
export function VirtualGrid<T>({
  items,
  cellWidth,
  cellHeight,
  overscanRows = 3,
  renderCell,
}: VirtualGridProps<T>): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cols = Math.max(1, Math.floor(size.width / cellWidth));
  const rows = Math.ceil(items.length / cols);
  const totalHeight = rows * cellHeight;

  const startRow = Math.max(0, Math.floor(scrollTop / cellHeight) - overscanRows);
  const endRow = Math.min(
    rows,
    Math.ceil((scrollTop + size.height) / cellHeight) + overscanRows,
  );

  const cells: React.ReactNode[] = [];
  for (let row = startRow; row < endRow; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if (index >= items.length) break;
      cells.push(
        <div
          key={index}
          className="cell"
          style={{
            position: 'absolute',
            top: row * cellHeight,
            left: col * cellWidth,
            width: cellWidth,
            height: cellHeight,
          }}
        >
          {renderCell(items[index], index)}
        </div>,
      );
    }
  }

  return (
    <div className="grid-scroll" ref={ref} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
      <div style={{ position: 'relative', height: totalHeight, width: cols * cellWidth, margin: '0 auto' }}>
        {cells}
      </div>
    </div>
  );
}
